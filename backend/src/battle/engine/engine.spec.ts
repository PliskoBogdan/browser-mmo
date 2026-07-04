import { CombatResolver, createInitialState } from './engine';
import { MONSTER_AI_PROFILES, MonsterAiProfile } from './monster-ai.config';
import { SKILL_BY_CODE } from './skills.config';
import { PERK_BY_CODE } from '../../character/perks.config';
import type { EngineContext } from './types';

// rng that returns the given values in order, then repeats the last one.
function seqRng(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function makeCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    player: {
      combat: {
        maxHp: 100,
        healthRegenPerCycle: 0,
        evasionChance: 0,
        critChance: 0,
        critMultiplier: 1.5,
        attackDamage: 20,
        attackSpeed: 1,
        attackCooldownMs: 1000,
      },
      defense: 0,
    },
    monster: { name: 'Wolf', maxHp: 100, damage: 10, defense: 0, attackSpeed: 1 },
    playerTriggers: [],
    monsterAi: MONSTER_AI_PROFILES.basic,
    // High roll: no evades, no crits, no chance-procs by default.
    rng: seqRng(0.99),
    ...overrides,
  };
}

function skill(code: string) {
  const def = SKILL_BY_CODE.get(code);
  if (!def) throw new Error(`Unknown skill ${code}`);
  return def;
}

function perkTriggers(code: string) {
  const perk = PERK_BY_CODE.get(code);
  if (!perk?.triggers) throw new Error(`Perk ${code} has no triggers`);
  return perk.triggers;
}

describe('CombatResolver', () => {
  it('monster tick deals its damage to the player', () => {
    const ctx = makeCtx();
    const resolver = new CombatResolver(ctx, createInitialState(ctx), 100, 100);
    resolver.resolveMonsterTicks(1);
    expect(resolver.playerHp).toBe(90);
    expect(resolver.totalMonsterDamage).toBe(10);
  });

  it('guard blocks 60% of incoming damage for its duration', () => {
    const ctx = makeCtx();
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 100, 100);
    resolver.resolveSkill(skill('guard'));
    resolver.resolveMonsterTicks(2);
    // 10 dmg -> 4 per tick while guarding
    expect(resolver.playerHp).toBe(92);
    // guard expired after 2 ticks
    resolver.resolveMonsterTicks(1);
    expect(resolver.playerHp).toBe(82);
  });

  it('strike builds momentum, heavy blow spends it', () => {
    const ctx = makeCtx();
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 100, 1000);
    resolver.resolveSkill(skill('strike'));
    expect(state.momentum).toBe(1);
    state.momentum = 3;
    resolver.resolveSkill(skill('heavy_blow'));
    expect(state.momentum).toBe(0);
    // 220% of 20 = 44
    expect(resolver.totalPlayerDamage).toBe(20 + 44);
  });

  it('heavy blow interrupts a telegraphed HEAVY intent', () => {
    const ctx = makeCtx();
    const state = createInitialState(ctx);
    state.intent = { kind: 'HEAVY' };
    state.momentum = 3;
    const resolver = new CombatResolver(ctx, state, 100, 1000);
    resolver.resolveSkill(skill('heavy_blow'));
    expect(state.intent.kind).toBe('ATTACK');
  });

  it('rend applies bleed and the DoT ticks on the monster', () => {
    const ctx = makeCtx();
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 100, 100);
    resolver.resolveSkill(skill('rend'));
    // 65% of 20 = 13
    expect(resolver.monsterHp).toBe(87);
    const bleed = state.monsterStatuses.find((s) => s.code === 'bleed');
    expect(bleed).toMatchObject({ stacks: 2, power: 3 }); // 15% of 20 per stack
    resolver.resolveMonsterTicks(1);
    // bleed: 3 * 2 stacks = 6
    expect(resolver.monsterHp).toBe(81);
  });

  it('stunned monster skips its attack and consumes a stack', () => {
    // rolls: initial intent (0.5), crit (0.99), stun chance (0.1 < 0.35 -> stun)
    const ctx = makeCtx({ rng: seqRng(0.5, 0.99, 0.1, 0.99) });
    const state = createInitialState(ctx);
    state.momentum = 3;
    const resolver = new CombatResolver(ctx, state, 100, 1000);
    resolver.resolveSkill(skill('heavy_blow'));
    expect(state.monsterStatuses.some((s) => s.code === 'stun')).toBe(true);
    resolver.resolveMonsterTicks(1);
    expect(resolver.playerHp).toBe(100);
    expect(state.monsterStatuses.some((s) => s.code === 'stun')).toBe(false);
  });

  it('riposte perk: evade grants +50% on the next strike, then is consumed', () => {
    // rolls: initial intent (0.5), evade (0.1 < 0.5), then no crits (0.99)
    const ctx = makeCtx({ playerTriggers: perkTriggers('riposte'), rng: seqRng(0.5, 0.1, 0.99) });
    ctx.player.combat.evasionChance = 0.5; // rng 0.1 -> evade
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 100, 1000);
    resolver.resolveMonsterTicks(1);
    expect(resolver.playerHp).toBe(100);
    expect(state.playerStatuses.some((s) => s.code === 'riposte')).toBe(true);
    resolver.resolveSkill(skill('strike'));
    // 20 * 1.5 = 30
    expect(resolver.totalPlayerDamage).toBe(30);
    expect(state.playerStatuses.some((s) => s.code === 'riposte')).toBe(false);
    resolver.resolveSkill(skill('strike'));
    expect(resolver.totalPlayerDamage).toBe(50);
  });

  it('combat flow perk grants +1 momentum every 3rd hit', () => {
    const ctx = makeCtx({ playerTriggers: perkTriggers('combat_flow') });
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 100, 1000);
    resolver.resolveSkill(skill('strike'));
    resolver.resolveSkill(skill('strike'));
    expect(state.momentum).toBe(2);
    resolver.resolveSkill(skill('strike'));
    // 3rd hit: +1 from the trigger, +1 from the skill
    expect(state.momentum).toBe(4);
  });

  it('second wind fires only once per battle', () => {
    const ctx = makeCtx({ playerTriggers: perkTriggers('second_wind') });
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 35, 100);
    resolver.resolveMonsterTicks(1);
    // 35 - 10 = 25 (below 30%) -> heal 15% of 100 = +15
    expect(resolver.playerHp).toBe(40);
    resolver.resolveMonsterTicks(2);
    // no second proc even though hp drops below 30 again
    expect(resolver.playerHp).toBe(20);
  });

  it('bloodlust heals 10% max HP when the monster dies', () => {
    const ctx = makeCtx({ playerTriggers: perkTriggers('bloodlust') });
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 50, 10);
    resolver.resolveSkill(skill('strike'));
    expect(resolver.monsterDied).toBe(true);
    expect(resolver.playerHp).toBe(60);
  });

  it('a defending monster takes reduced damage until its next tick', () => {
    const defendOnly: MonsterAiProfile = { code: 'test', intents: [{ kind: 'DEFEND', weight: 100 }], triggers: [] };
    const ctx = makeCtx({ monsterAi: defendOnly });
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 100, 100);
    resolver.resolveMonsterTicks(1);
    expect(resolver.playerHp).toBe(100); // defending, no attack
    resolver.resolveSkill(skill('strike'));
    // 20 * 0.4 = 8
    expect(resolver.monsterHp).toBe(92);
  });

  it('monster AI enrages once below 50% HP (feral)', () => {
    const ctx = makeCtx({ monsterAi: MONSTER_AI_PROFILES.feral });
    const state = createInitialState(ctx);
    state.intent = { kind: 'ATTACK' };
    const resolver = new CombatResolver(ctx, state, 200, 60);
    resolver.resolveSkill(skill('strike')); // 60 -> 40, below 50% of 100
    expect(state.monsterStatuses.some((s) => s.code === 'enrage')).toBe(true);
    resolver.resolveMonsterTicks(1);
    // 10 * 1.3 = 13
    expect(resolver.totalMonsterDamage).toBe(13);
  });

  it('player can die from replayed ticks', () => {
    const ctx = makeCtx();
    const state = createInitialState(ctx);
    const resolver = new CombatResolver(ctx, state, 25, 100);
    resolver.resolveMonsterTicks(10);
    expect(resolver.playerDied).toBe(true);
    expect(resolver.playerHp).toBe(0);
    // resolver stops ticking after death
    expect(resolver.totalMonsterDamage).toBe(30);
  });
});
