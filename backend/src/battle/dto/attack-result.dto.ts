import { BattleStatus } from '../../../prisma/generated/client/enums';

export class AttackResultDto {
  playerDamageDealt: number;
  monsterDamageDealt: number;
  monsterCurrentHp: number;
  monsterMaxHp: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  battleStatus: BattleStatus;
  isCrit: boolean;
  evaded: number;
  expGained: number;
  goldGained: number;
  leveledUp: boolean;
  statPointsGained: number;
  perkPointsGained: number;
  playerDied: boolean;
  attackCooldownMs: number;
  newPosition?: { x: number; y: number };
  lootDrops?: { name: string; quantity: number; rarity: string }[];
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
  };
}
