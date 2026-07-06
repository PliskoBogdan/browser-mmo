// Canonical stat/equipment/perk types shared across backend and frontend.

export const CORE_STATS = ['strength', 'agility', 'accuracy', 'endurance', 'criticalDamage', 'defense'] as const;

export type CoreStat = (typeof CORE_STATS)[number];

// A full set of the six core stats. Used for base values, modifier bundles, etc.
export type StatBlock = Record<CoreStat, number>;

// Per-stat breakdown surfaced to the UI: where each point of a stat comes from.
export interface StatBreakdown {
  base: number;
  equipment: number;
  perk: number;
  final: number;
}

export type StatBreakdownBlock = Record<CoreStat, StatBreakdown>;

export type EquipmentSlot = 'WEAPON' | 'HELMET' | 'BODY' | 'PANTS' | 'GLOVES';

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['WEAPON', 'HELMET', 'BODY', 'PANTS', 'GLOVES'];

export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE';

// Derived combat numbers computed from final stats + equipped weapon.
export interface CombatProfile {
  maxHp: number;
  maxStamina: number;
  healthRegenPerCycle: number;
  evasionChance: number; // 0..0.6
  critChance: number; // 0..0.75
  critMultiplier: number; // criticalDamage / 100
  attackDamage: number; // weapon base damage + strength bonus (pre-crit, pre-enemy-defense)
  attackSpeed: number | null; // null when no weapon equipped
  attackCooldownMs: number | null;
}

export interface PerkEffect {
  // Flat additions to core stats.
  stats?: Partial<StatBlock>;
  // Extra health regeneration, as a fraction (0.1 = +10%).
  healthRegenBonus?: number;
}

export interface PerkDefinition {
  code: string;
  name: string;
  description: string;
  requiredLevel: number;
  effect: PerkEffect;
  // Reactive combat behaviour (see battle.interface.ts). A perk may have flat
  // stat bonuses, triggers, or both.
  triggers?: import('./battle.interface').CombatTriggerDef[];
}

export interface PerkView extends PerkDefinition {
  unlocked: boolean;
  canUnlock: boolean; // meets level requirement, not yet unlocked, has a perk point
}
