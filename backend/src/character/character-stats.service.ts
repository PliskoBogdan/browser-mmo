import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CombatProfile, CoreStat, StatBlock, StatBreakdownBlock } from '@my/shared';
import { CORE_STATS } from './stats.constants';
import { PERK_BY_CODE } from './perks.config';

// --- Tunable game constants (single source of truth per the spec) ---
export const BASE_MAX_HP = 100;
export const STAT_POINTS_PER_LEVEL = 3;

const STRENGTH_HP_MULT = 10;
const STRENGTH_REGEN_MULT = 0.2;
const STRENGTH_DAMAGE_MULT = 0.5;

const MAX_EVASION = 0.6;
const MAX_CRIT_CHANCE = 0.75;
const MAX_DAMAGE_REDUCTION = 0.7;

// How often (ms) one health-regeneration cycle elapses for lazy regen.
export const REGEN_INTERVAL_MS = 10_000;

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
    const strength = Math.max(0, final.strength);
    const agility = Math.max(0, final.agility);
    const accuracy = Math.max(0, final.accuracy);

    const maxHp = BASE_MAX_HP + strength * STRENGTH_HP_MULT;
    const healthRegenPerCycle = strength * STRENGTH_REGEN_MULT * (1 + regenBonus);

    const attackSpeed = weapon?.attackSpeed ?? null;
    const attackDamage = weapon ? weapon.baseDamage + Math.floor(strength * STRENGTH_DAMAGE_MULT) : 0;

    return {
      maxHp,
      healthRegenPerCycle,
      evasionChance: Math.min(MAX_EVASION, agility / (agility + 100)),
      critChance: Math.min(MAX_CRIT_CHANCE, accuracy / (accuracy + 100)),
      critMultiplier: Math.max(1, final.criticalDamage / 100),
      attackDamage,
      attackSpeed,
      attackCooldownMs: attackSpeed ? Math.round((1 / attackSpeed) * 1000) : null,
    };
  }

  // Fraction of incoming damage removed by a given defense value (0..0.7).
  static damageReduction(defense: number): number {
    const d = Math.max(0, defense);
    return Math.min(MAX_DAMAGE_REDUCTION, d / (d + 100));
  }

  private zeroBlock(): StatBlock {
    return { strength: 0, agility: 0, accuracy: 0, endurance: 0, criticalDamage: 0, defense: 0 } satisfies Record<CoreStat, number>;
  }
}
