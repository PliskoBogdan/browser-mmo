import { BattleStatus } from '../../../prisma/generated/client/enums';
import type { BattleStateView, CombatEventView } from '@my/shared';

export class AttackResultDto {
  skillUsed: string;
  playerDamageDealt: number;
  monsterDamageDealt: number;
  monsterCurrentHp: number;
  monsterMaxHp: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  battleStatus: BattleStatus;
  isCrit: boolean;
  evaded: number;
  // Ordered log of everything that happened this action (ticks, procs, DoTs).
  events: CombatEventView[];
  // Snapshot of momentum/statuses/intent/skills; null once the battle ended.
  state: BattleStateView | null;
  expGained: number;
  goldGained: number;
  leveledUp: boolean;
  statPointsGained: number;
  perkPointsGained: number;
  playerDied: boolean;
  attackCooldownMs: number;
  newPosition?: { x: number; y: number };
  // `banked: true` (gate items) landed in the real inventory immediately;
  // everything else went into the at-risk rift bag pending extraction.
  lootDrops?: { name: string; quantity: number; rarity: string; banked?: boolean }[];
  // True when the fight happened inside a rift: table loot goes to the
  // at-risk rift bag instead of the inventory, and the client should return
  // to the rift on victory.
  riftBattle?: boolean;
  // Set when a rift death forfeited part of the staged rift bag.
  lostLoot?: { name: string; quantity: number; rarity: string }[];
}

export class EnterBattleResultDto {
  message: string;
  isSafe: boolean;
  battle?: {
    id: number;
    monster: {
      id: number;
      name: string;
      maxHp: number;
      currentHp: number;
      damage: number;
      attackSpeed: number;
    };
    attackCooldownMs: number;
    state: BattleStateView;
  };
}
