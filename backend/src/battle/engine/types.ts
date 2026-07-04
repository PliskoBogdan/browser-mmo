import type { CombatProfile, CombatTriggerDef, IntentKind, StatusCode } from '@my/shared';
import type { MonsterAiProfile } from './monster-ai.config';

// One applied status on either combatant. `power` is the damage dealt per
// stack per tick, frozen at application time so later stat changes don't
// retroactively change an existing DoT. `remainingTicks: -1` means the status
// never expires on the clock (it is consumed by some other rule, e.g. riposte).
export interface StatusInstance {
  code: StatusCode;
  stacks: number;
  remainingTicks: number;
  power?: number;
}

export interface MonsterIntent {
  kind: IntentKind;
}

// The dynamic part of a battle, persisted as `Battle.state` JSON between
// requests. Everything here is plain data — the engine owns all behaviour.
export interface BattleRuntimeState {
  momentum: number;
  playerStatuses: StatusInstance[];
  monsterStatuses: StatusInstance[];
  // What the monster will do on its NEXT tick. Shown to the player so they
  // can react (guard a heavy blow, interrupt, etc.).
  intent: MonsterIntent;
  // Per-skill cooldown anchors: epoch ms when each skill becomes usable.
  skillReadyAt: Record<string, number>;
  // everyNth counters, keyed by trigger id.
  counters: Record<string, number>;
  // oncePerBattle trigger ids that already fired.
  firedOnce: string[];
  // HP-threshold events fire once per crossing.
  playerHpBelow30Fired: boolean;
  monsterHpBelow50Fired: boolean;
}

export interface EngineMonster {
  name: string;
  maxHp: number;
  damage: number;
  defense: number;
  attackSpeed: number;
}

export interface EnginePlayer {
  combat: CombatProfile;
  defense: number;
}

// Everything the resolver needs that is NOT battle state: combatant numbers,
// the trigger sets contributed by perks and monster AI, and the RNG (injected
// so tests can be deterministic).
export interface EngineContext {
  player: EnginePlayer;
  monster: EngineMonster;
  playerTriggers: CombatTriggerDef[];
  monsterAi: MonsterAiProfile;
  rng: () => number;
}
