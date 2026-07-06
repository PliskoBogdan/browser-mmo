import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../prisma/generated/client/client';
import { RiftRunStatus } from '../../prisma/generated/client/enums';
import { calculateLevelUp } from '../character/leveling';
import { perkPointsForLevel } from '../character/perks.config';
import { RIFT_BONUS_DROPS } from '../rift/rift.config';
import { applyDeathPenalty, parseRiftLoot } from '../rift/rift-loot';
import { grantItem } from '../inventory/inventory.util';
import { GAME_CONFIG } from '../config/game.config';
import type { RiftLootEntry } from '@my/shared';

export interface KillRewards {
  expGained: number;
  goldGained: number;
  newLevel: number;
  remainingExp: number;
  leveledUp: boolean;
  statPointsGained: number;
  perkPointsGained: number;
}

export interface LootDrop {
  name: string;
  quantity: number;
  rarity: string;
}

type LootTableEntry = {
  itemId: number;
  dropChance: number;
  minQuantity: number;
  maxQuantity: number;
  item: { name: string; rarity: string };
};

// Everything a monster kill pays out — exp/gold/level-ups (with the global
// reward multipliers applied) and loot rolls. Split from BattleService so the
// battle flow reads as orchestration and the reward math is testable on its own.
@Injectable()
export class BattleRewardsService {
  constructor(private prisma: PrismaService) {}

  computeKillRewards(user: { level: number; exp: number }, monster: { expReward: number; goldReward: number }): KillRewards {
    const expGained = Math.round(monster.expReward * GAME_CONFIG.rewards.expMultiplier);
    const goldGained = Math.round(monster.goldReward * GAME_CONFIG.rewards.goldMultiplier);
    const { level: newLevel, remainingExp } = calculateLevelUp(user.level, user.exp + expGained);
    return {
      expGained,
      goldGained,
      newLevel,
      remainingExp,
      leveledUp: newLevel > user.level,
      statPointsGained: (newLevel - user.level) * GAME_CONFIG.leveling.statPointsPerLevel,
      perkPointsGained: perkPointsForLevel(newLevel) - perkPointsForLevel(user.level),
    };
  }

  rollLoot(loot: LootTableEntry[], chanceBonus = 0): LootDrop[] {
    const drops: LootDrop[] = [];
    for (const entry of loot) {
      const chance = Math.min(entry.dropChance + chanceBonus, GAME_CONFIG.rift.lootChanceCap);
      if (Math.random() * 100 >= chance) continue;
      const quantity = entry.minQuantity + Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1));
      drops.push({ name: entry.item.name, quantity, rarity: entry.item.rarity });
    }
    return drops;
  }

  // Rift-only extra drops (torches, keys) rolled on top of the normal table.
  async rollRiftBonusDrops(): Promise<RiftLootEntry[]> {
    const items = await this.prisma.item.findMany({ where: { name: { in: RIFT_BONUS_DROPS.map((d) => d.itemName) } } });
    const byName = new Map(items.map((i) => [i.name, i]));

    const drops: RiftLootEntry[] = [];
    for (const def of RIFT_BONUS_DROPS) {
      const item = byName.get(def.itemName);
      if (!item || Math.random() * 100 >= def.chance) continue;
      const quantity = def.minQuantity + Math.floor(Math.random() * (def.maxQuantity - def.minQuantity + 1));
      drops.push({ itemId: item.id, name: item.name, rarity: item.rarity, quantity });
    }
    return drops;
  }

  // Rift death: part of the staged rift bag is forfeited, the rest is banked
  // to the inventory, and the run ends. Returns what was lost so the caller
  // can show it on the death screen.
  async applyRiftDeath(tx: Prisma.TransactionClient, userId: number): Promise<RiftLootEntry[]> {
    const run = await tx.riftRun.findFirst({ where: { userId, status: RiftRunStatus.ACTIVE } });
    if (!run) return [];

    const { kept, lost } = applyDeathPenalty(parseRiftLoot(run.loot), GAME_CONFIG.death.riftLootKeepRatio);
    for (const entry of kept) {
      await grantItem(tx, userId, entry.itemId, entry.quantity);
    }
    await tx.riftRun.update({
      where: { id: run.id },
      data: { status: RiftRunStatus.DEAD, loot: kept as unknown as Prisma.InputJsonValue },
    });
    return lost;
  }
}
