// Combat view types shared between the battle engine (backend) and the battle UI.

export type StatusCode =
  | 'bleed'
  | 'poison'
  | 'stun'
  | 'weaken'
  | 'enrage'
  | 'guard'
  | 'dodge_stance'
  | 'riposte';

export type StatusKind = 'BUFF' | 'DEBUFF';

export interface StatusView {
  code: StatusCode;
  name: string;
  icon: string; // mdi icon name
  kind: StatusKind;
  stacks: number;
  remainingTicks: number;
  description: string;
}

export interface SkillView {
  code: string;
  name: string;
  description: string;
  icon: string;
  momentumCost: number;
  momentumGain: number;
  remainingCooldownMs: number;
  ready: boolean;
  blockedReason?: string; // e.g. "Not enough momentum"
}

export type IntentKind = 'ATTACK' | 'HEAVY' | 'DEFEND' | 'ABILITY';

export interface MonsterIntentView {
  kind: IntentKind;
  label: string;
  icon: string;
  estimatedDamage?: number;
}

// --- Trigger system ---
// Everything that happens in combat emits an event; triggers (from perks,
// skills and monster abilities) subscribe to events and run effects. Both
// halves are plain serializable data so game content stays config-driven.

export type CombatEventType =
  | 'BATTLE_START'
  | 'PLAYER_HIT' // player landed a hit (payload: damage, isCrit)
  | 'PLAYER_CRIT'
  | 'PLAYER_EVADE'
  | 'MONSTER_HIT' // monster landed a hit on the player
  | 'STATUS_DAMAGE'
  | 'PLAYER_HP_BELOW_30' // emitted once when crossing the threshold
  | 'MONSTER_HP_BELOW_50'
  | 'MONSTER_KILLED';

export type CombatEffectDef =
  | { type: 'DAMAGE_MONSTER'; percentOfAttack?: number; flat?: number }
  | { type: 'HEAL_PLAYER'; percentOfMax?: number; flat?: number }
  | { type: 'APPLY_STATUS'; target: 'PLAYER' | 'MONSTER'; status: StatusCode; stacks?: number; ticks?: number; chance?: number }
  | { type: 'GAIN_MOMENTUM'; amount: number };

export interface CombatTriggerDef {
  id: string;
  on: CombatEventType;
  chance?: number; // 0..1, defaults to 1
  oncePerBattle?: boolean;
  everyNth?: number; // fire only on every Nth matching event
  effects: CombatEffectDef[];
}

export type CombatEventTone = 'player-hit' | 'monster-hit' | 'crit' | 'status' | 'heal' | 'info';

export interface CombatEventView {
  text: string;
  tone: CombatEventTone;
}

// Snapshot of the dynamic battle state sent to the client after every action.
export interface BattleStateView {
  momentum: number;
  maxMomentum: number;
  playerStatuses: StatusView[];
  monsterStatuses: StatusView[];
  intent: MonsterIntentView | null;
  skills: SkillView[];
}
