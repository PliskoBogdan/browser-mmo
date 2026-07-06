import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CombatProfile, CoreStat, StatBlock, StatBreakdownBlock } from '@my/shared';
import { CORE_STATS } from './stats.constants';
import { damageReduction } from './stats.formulas';
import { PERK_BY_CODE } from './perks.config';
import { GAME_CONFIG } from '../config/game.config';

// All formula tunables live in GAME_CONFIG.combat — retune the game there.

// The default stats a brand-new character starts with.
export const DEFAULT_CHARACTER_STATS: StatBlock = {
  strength: 5,
  agility: 5,
  accuracy: 5,
  endurance: 5,
  criticalDamage: 150,
  defense: 0,
};

type EquipmentItemStats = {
  slot: string;
  baseDamage: number;
  attackSpeed: number | null;
} & StatBlock;

export interface StatsUser {
  strength: number;
  agility: number;
  accuracy: number;
  endurance: number;
  criticalDamage: number;
  defense: number;
  ownedEquipment: { equipped: boolean; equipmentItem: EquipmentItemStats }[];
  perks: { perkCode: string }[];
}

export interface CharacterProfile {
  breakdown: StatBreakdownBlock;
  final: StatBlock;
  combat: CombatProfile;
}

// Prisma include that loads everything computeProfile needs in one query.
export const STATS_INCLUDE = {
  ownedEquipment: { where: { equipped: true }, include: { equipmentItem: true } },
  perks: true,
} as const;

@Injectable()
export class CharacterStatsService {
  constructor(private prisma: PrismaService) {}

  async load(userId: number): Promise<(StatsUser & { id: number; hp: number; maxHp: number; isDead: boolean }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: STATS_INCLUDE,
    });
    return user as never;
  }

  // Builds the full base/equipment/perk/final breakdown plus derived combat
  // numbers. Pure function of the passed-in data — no DB access — so callers
  // that already loaded the user (e.g. the battle loop) can reuse it cheaply.
  computeProfile(user: StatsUser): CharacterProfile {
    const base: StatBlock = {
      strength: user.strength,
      agility: user.agility,
      accuracy: user.accuracy,
      endurance: user.endurance,
      criticalDamage: user.criticalDamage,
      defense: user.defense,
    };

    const equipmentBonus = this.zeroBlock();
    let weapon: EquipmentItemStats | null = null;
    for (const owned of user.ownedEquipment) {
      if (!owned.equipped) continue;
      const item = owned.equipmentItem;
      for (const stat of CORE_STATS) equipmentBonus[stat] += item[stat];
      if (item.slot === 'WEAPON') weapon = item;
    }

    const perkBonus = this.zeroBlock();
    let regenBonus = 0;
    for (const { perkCode } of user.perks) {
      const perk = PERK_BY_CODE.get(perkCode);
      if (!perk) continue;
      for (const stat of CORE_STATS) perkBonus[stat] += perk.effect.stats?.[stat] ?? 0;
      regenBonus += perk.effect.healthRegenBonus ?? 0;
    }

    const breakdown = {} as StatBreakdownBlock;
    const final = this.zeroBlock();
    for (const stat of CORE_STATS) {
      const value = base[stat] + equipmentBonus[stat] + perkBonus[stat];
      breakdown[stat] = { base: base[stat], equipment: equipmentBonus[stat], perk: perkBonus[stat], final: value };
      final[stat] = value;
    }
    // Crits must never deal less than a normal hit.
    if (final.criticalDamage < 100) final.criticalDamage = 100;

    const combat = this.deriveCombat(final, weapon, regenBonus);
    return { breakdown, final, combat };
  }

  private deriveCombat(final: StatBlock, weapon: EquipmentItemStats | null, regenBonus: number): CombatProfile {
    const cfg = GAME_CONFIG.combat;
    const strength = Math.max(0, final.strength);
    const agility = Math.max(0, final.agility);
    const accuracy = Math.max(0, final.accuracy);

    const maxHp = cfg.baseMaxHp + strength * cfg.strengthHpMult;
    const healthRegenPerCycle = strength * cfg.strengthRegenMult * (1 + regenBonus);

    const attackSpeed = weapon?.attackSpeed ?? null;
    const attackDamage = weapon ? weapon.baseDamage + Math.floor(strength * cfg.strengthDamageMult) : 0;

    return {
      maxHp,
      healthRegenPerCycle,
      evasionChance: Math.min(cfg.maxEvasion, agility / (agility + 100)),
      critChance: Math.min(cfg.maxCritChance, accuracy / (accuracy + 100)),
      critMultiplier: Math.max(1, final.criticalDamage / 100),
      attackDamage,
      attackSpeed,
      attackCooldownMs: attackSpeed ? Math.round((1 / attackSpeed) * 1000) : null,
    };
  }

  // Fraction of incoming damage removed by a given defense value (0..0.7).
  static damageReduction(defense: number): number {
    return damageReduction(defense);
  }

  private zeroBlock(): StatBlock {
    return { strength: 0, agility: 0, accuracy: 0, endurance: 0, criticalDamage: 0, defense: 0 } satisfies Record<CoreStat, number>;
  }
}
