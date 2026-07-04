import type { CombatEffectDef, CombatEventType, CombatEventView, StatusCode } from '@my/shared';
import type { BattleRuntimeState, EngineContext, StatusInstance } from './types';
import { damageReduction } from '../../character/stats.formulas';
import { MAX_MOMENTUM, SkillDefinition } from './skills.config';
import { HEAVY_DAMAGE_MULT } from './monster-ai.config';
import {
  BLEED_POWER_FRACTION,
  DODGE_STANCE_EVASION_MULT,
  ENRAGE_OUTGOING_MULT,
  GUARD_INCOMING_MULT,
  MAX_EVASION_WITH_STANCE,
  POISON_POWER_FRACTION,
  RIPOSTE_DAMAGE_MULT,
  STATUS_META,
  WEAKEN_OUTGOING_MULT,
} from './statuses.config';

// Effects fired by triggers may emit further events (a kill heal, a DoT that
// finishes the monster, ...). The chain is depth-limited so content authors
// can never write an infinite loop.
const MAX_TRIGGER_DEPTH = 5;

const DOT_STATUSES: StatusCode[] = ['bleed', 'poison'];

export function createInitialState(ctx: EngineContext): BattleRuntimeState {
  const state: BattleRuntimeState = {
    momentum: 0,
    playerStatuses: [],
    monsterStatuses: [],
    intent: { kind: 'ATTACK' },
    skillReadyAt: {},
    counters: {},
    firedOnce: [],
    playerHpBelow30Fired: false,
    monsterHpBelow50Fired: false,
  };
  state.intent = rollIntent(ctx);
  return state;
}

export function rollIntent(ctx: EngineContext): { kind: 'ATTACK' | 'HEAVY' | 'DEFEND' | 'ABILITY' } {
  const intents = ctx.monsterAi.intents;
  const total = intents.reduce((sum, i) => sum + i.weight, 0);
  let roll = ctx.rng() * total;
  for (const intent of intents) {
    roll -= intent.weight;
    if (roll <= 0) return { kind: intent.kind };
  }
  return { kind: intents[intents.length - 1].kind };
}

// Resolves combat time (monster ticks) and player actions against a mutable
// copy of the battle state. Pure aside from ctx.rng: no I/O, no clocks — the
// caller decides how many ticks elapsed and persists the resulting state.
export class CombatResolver {
  events: CombatEventView[] = [];
  totalPlayerDamage = 0;
  totalMonsterDamage = 0;
  evaded = 0;
  lastHitWasCrit = false;
  playerDied = false;
  monsterDied = false;

  constructor(
    private ctx: EngineContext,
    private state: BattleRuntimeState,
    public playerHp: number,
    public monsterHp: number,
  ) {}

  // --- Monster ticks (the shared combat clock) ---

  resolveMonsterTicks(ticks: number) {
    for (let i = 0; i < ticks && !this.playerDied && !this.monsterDied; i++) {
      this.resolveOneTick();
    }
  }

  private resolveOneTick() {
    // 1. DoTs burn first, on both sides.
    this.tickDots('MONSTER');
    if (this.monsterDied) return;
    this.tickDots('PLAYER');
    if (this.playerDied) return;

    // 2. The monster acts out its telegraphed intent.
    const monsterName = this.ctx.monster.name;
    const stun = this.findStatus('MONSTER', 'stun');
    if (stun) {
      this.consumeStack(this.state.monsterStatuses, stun);
      this.log(`${monsterName} is stunned and misses its turn!`, 'status');
    } else if (this.state.intent.kind === 'DEFEND') {
      // Guard lasts through the upcoming player actions and expires after the
      // monster's next tick (durations are decremented at end of tick).
      this.applyStatusTo('MONSTER', 'guard', 1, 2);
      this.log(`${monsterName} braces behind its guard.`, 'status');
    } else {
      this.monsterAttack(this.state.intent.kind === 'HEAVY');
      if (this.playerDied) return;
    }

    // 3. Durations wind down; -1 means "until consumed".
    this.state.playerStatuses = this.expireStatuses(this.state.playerStatuses);
    this.state.monsterStatuses = this.expireStatuses(this.state.monsterStatuses);

    // 4. Telegraph the next move.
    this.state.intent = rollIntent(this.ctx);
  }

  private monsterAttack(isHeavy: boolean) {
    const { monster, player } = this.ctx;

    let evasion = player.combat.evasionChance;
    if (this.findStatus('PLAYER', 'dodge_stance')) {
      evasion = Math.min(MAX_EVASION_WITH_STANCE, evasion * DODGE_STANCE_EVASION_MULT);
    }
    if (this.ctx.rng() < evasion) {
      this.evaded++;
      this.log(`You evade ${monster.name}'s attack!`, 'status');
      this.emit('PLAYER_EVADE');
      return;
    }

    let damage = monster.damage * (isHeavy ? HEAVY_DAMAGE_MULT : 1);
    if (this.findStatus('MONSTER', 'enrage')) damage *= ENRAGE_OUTGOING_MULT;
    if (this.findStatus('MONSTER', 'weaken')) damage *= WEAKEN_OUTGOING_MULT;
    damage *= 1 - damageReduction(player.defense);
    if (this.findStatus('PLAYER', 'guard')) damage *= GUARD_INCOMING_MULT;
    const dealt = Math.max(1, Math.round(damage));

    this.playerHp = Math.max(0, this.playerHp - dealt);
    this.totalMonsterDamage += dealt;
    this.log(`${monster.name} hits you for ${dealt}${isHeavy ? ' (heavy blow!)' : ''}`, 'monster-hit');
    this.emit('MONSTER_HIT');
    this.checkPlayerThreshold();
    this.checkPlayerDeath();
  }

  // --- Player action ---

  resolveSkill(skill: SkillDefinition) {
    this.state.momentum = Math.max(0, this.state.momentum - skill.momentumCost);

    if (skill.interruptsHeavy && this.state.intent.kind === 'HEAVY') {
      this.state.intent = { kind: 'ATTACK' };
      this.log(`You interrupt ${this.ctx.monster.name}'s heavy attack!`, 'status');
    }

    if (skill.damagePercent > 0) {
      this.playerAttack(skill.damagePercent);
    } else {
      this.log(`You use ${skill.name}.`, 'info');
    }

    if (!this.monsterDied) {
      for (const effect of skill.effects ?? []) this.applyEffect(effect, 0);
    }

    this.state.momentum = Math.min(MAX_MOMENTUM, this.state.momentum + skill.momentumGain);
  }

  private playerAttack(damagePercent: number) {
    const { player, monster } = this.ctx;

    let damage = player.combat.attackDamage * (damagePercent / 100);

    const riposte = this.findStatus('PLAYER', 'riposte');
    if (riposte) {
      damage *= RIPOSTE_DAMAGE_MULT;
      this.consumeStack(this.state.playerStatuses, riposte);
      this.log('Riposte! Your strike lands harder.', 'status');
    }
    if (this.findStatus('PLAYER', 'enrage')) damage *= ENRAGE_OUTGOING_MULT;
    if (this.findStatus('PLAYER', 'weaken')) damage *= WEAKEN_OUTGOING_MULT;

    const isCrit = this.ctx.rng() < player.combat.critChance;
    if (isCrit) damage *= player.combat.critMultiplier;

    damage *= 1 - damageReduction(monster.defense);
    if (this.findStatus('MONSTER', 'guard')) damage *= GUARD_INCOMING_MULT;
    const dealt = Math.max(1, Math.round(damage));

    this.monsterHp = Math.max(0, this.monsterHp - dealt);
    this.totalPlayerDamage += dealt;
    this.lastHitWasCrit = isCrit;
    this.log(`You hit ${monster.name} for ${dealt}${isCrit ? ' — CRITICAL!' : ''}`, isCrit ? 'crit' : 'player-hit');
    this.emit('PLAYER_HIT');
    if (isCrit) this.emit('PLAYER_CRIT');
    this.checkMonsterThreshold();
    this.checkMonsterDeath();
  }

  // --- Trigger pipeline ---

  private emit(type: CombatEventType, depth = 0) {
    if (depth > MAX_TRIGGER_DEPTH) return;
    const triggers = [...this.ctx.playerTriggers, ...this.ctx.monsterAi.triggers];
    for (const trigger of triggers) {
      if (trigger.on !== type) continue;
      if (trigger.oncePerBattle && this.state.firedOnce.includes(trigger.id)) continue;
      if (trigger.everyNth) {
        const count = (this.state.counters[trigger.id] ?? 0) + 1;
        this.state.counters[trigger.id] = count;
        if (count % trigger.everyNth !== 0) continue;
      }
      if (trigger.chance !== undefined && this.ctx.rng() >= trigger.chance) continue;
      if (trigger.oncePerBattle) this.state.firedOnce.push(trigger.id);
      for (const effect of trigger.effects) this.applyEffect(effect, depth + 1);
    }
  }

  private applyEffect(effect: CombatEffectDef, depth: number) {
    switch (effect.type) {
      case 'DAMAGE_MONSTER': {
        // Proc damage is a reward for the trigger firing — it bypasses defense.
        const amount = Math.max(
          1,
          Math.round((effect.flat ?? 0) + this.ctx.player.combat.attackDamage * ((effect.percentOfAttack ?? 0) / 100)),
        );
        this.monsterHp = Math.max(0, this.monsterHp - amount);
        this.totalPlayerDamage += amount;
        this.log(`${this.ctx.monster.name} takes ${amount} bonus damage!`, 'player-hit');
        this.checkMonsterThreshold(depth);
        this.checkMonsterDeath(depth);
        break;
      }
      case 'HEAL_PLAYER': {
        const maxHp = this.ctx.player.combat.maxHp;
        const amount = Math.max(1, Math.round((effect.flat ?? 0) + maxHp * ((effect.percentOfMax ?? 0) / 100)));
        this.playerHp = Math.min(maxHp, this.playerHp + amount);
        this.log(`You recover ${amount} HP.`, 'heal');
        break;
      }
      case 'APPLY_STATUS': {
        if (effect.chance !== undefined && this.ctx.rng() >= effect.chance) break;
        this.applyStatusTo(effect.target, effect.status, effect.stacks ?? 1, effect.ticks ?? -1);
        break;
      }
      case 'GAIN_MOMENTUM': {
        this.state.momentum = Math.min(MAX_MOMENTUM, this.state.momentum + effect.amount);
        this.log(`+${effect.amount} momentum.`, 'status');
        break;
      }
    }
  }

  // --- Statuses ---

  private applyStatusTo(target: 'PLAYER' | 'MONSTER', code: StatusCode, stacks: number, ticks: number) {
    const list = target === 'PLAYER' ? this.state.playerStatuses : this.state.monsterStatuses;
    const existing = list.find((s) => s.code === code);
    if (existing) {
      existing.stacks += stacks;
      existing.remainingTicks = ticks === -1 || existing.remainingTicks === -1 ? -1 : Math.max(existing.remainingTicks, ticks);
    } else {
      const instance: StatusInstance = { code, stacks, remainingTicks: ticks };
      // DoT power is frozen at application time, scaled off the applier.
      if (code === 'bleed' || code === 'poison') {
        const fraction = code === 'bleed' ? BLEED_POWER_FRACTION : POISON_POWER_FRACTION;
        const base = target === 'MONSTER' ? this.ctx.player.combat.attackDamage : this.ctx.monster.damage;
        instance.power = Math.max(1, Math.round(base * fraction));
      }
      list.push(instance);
    }
    const meta = STATUS_META[code];
    const who = target === 'PLAYER' ? 'You are' : `${this.ctx.monster.name} is`;
    this.log(`${who} ${meta.name}${stacks > 1 ? ` (${stacks})` : ''}.`, 'status');
  }

  private tickDots(target: 'PLAYER' | 'MONSTER') {
    const list = target === 'PLAYER' ? this.state.playerStatuses : this.state.monsterStatuses;
    for (const status of list) {
      if (!DOT_STATUSES.includes(status.code) || !status.power) continue;
      const damage = status.power * status.stacks;
      const meta = STATUS_META[status.code];
      if (target === 'MONSTER') {
        this.monsterHp = Math.max(0, this.monsterHp - damage);
        this.totalPlayerDamage += damage;
        this.log(`${meta.name} deals ${damage} to ${this.ctx.monster.name}.`, 'status');
        this.emit('STATUS_DAMAGE');
        this.checkMonsterThreshold();
        this.checkMonsterDeath();
        if (this.monsterDied) return;
      } else {
        this.playerHp = Math.max(0, this.playerHp - damage);
        this.totalMonsterDamage += damage;
        this.log(`${meta.name} deals ${damage} to you.`, 'monster-hit');
        this.emit('STATUS_DAMAGE');
        this.checkPlayerThreshold();
        this.checkPlayerDeath();
        if (this.playerDied) return;
      }
    }
  }

  private expireStatuses(list: StatusInstance[]): StatusInstance[] {
    return list.filter((status) => {
      if (status.stacks <= 0) return false;
      if (status.remainingTicks === -1) return true;
      status.remainingTicks -= 1;
      return status.remainingTicks > 0;
    });
  }

  private findStatus(target: 'PLAYER' | 'MONSTER', code: StatusCode): StatusInstance | undefined {
    const list = target === 'PLAYER' ? this.state.playerStatuses : this.state.monsterStatuses;
    const status = list.find((s) => s.code === code);
    return status && status.stacks > 0 ? status : undefined;
  }

  private consumeStack(list: StatusInstance[], status: StatusInstance) {
    status.stacks -= 1;
    if (status.stacks <= 0) {
      const index = list.indexOf(status);
      if (index >= 0) list.splice(index, 1);
    }
  }

  // --- Deaths & thresholds ---

  private checkMonsterDeath(depth = 0) {
    if (this.monsterDied || this.monsterHp > 0) return;
    this.monsterDied = true;
    this.log(`${this.ctx.monster.name} is slain!`, 'info');
    this.emit('MONSTER_KILLED', depth + 1);
  }

  private checkPlayerDeath() {
    if (this.playerDied || this.playerHp > 0) return;
    this.playerDied = true;
    this.log('You collapse from your wounds...', 'monster-hit');
  }

  private checkMonsterThreshold(depth = 0) {
    if (this.state.monsterHpBelow50Fired || this.monsterHp > this.ctx.monster.maxHp * 0.5) return;
    this.state.monsterHpBelow50Fired = true;
    this.emit('MONSTER_HP_BELOW_50', depth + 1);
  }

  private checkPlayerThreshold(depth = 0) {
    if (this.state.playerHpBelow30Fired || this.playerHp > this.ctx.player.combat.maxHp * 0.3) return;
    this.state.playerHpBelow30Fired = true;
    this.emit('PLAYER_HP_BELOW_30', depth + 1);
  }

  private log(text: string, tone: CombatEventView['tone']) {
    this.events.push({ text, tone });
  }
}
