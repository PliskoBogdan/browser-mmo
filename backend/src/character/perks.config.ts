import type { PerkDefinition } from '@my/shared';

// Perks are game content, so they live in code rather than the database. A
// player's *unlocked* perks are stored in the UserPerk table by `code`. Adding
// a new perk here requires no schema change — this is the data-driven surface
// the spec asks for.
export const PERK_DEFINITIONS: PerkDefinition[] = [
  {
    code: 'quick_reflexes',
    name: 'Quick Reflexes',
    description: '+10 Agility. Slip attacks more often.',
    requiredLevel: 3,
    effect: { stats: { agility: 10 } },
  },
  {
    code: 'iron_skin',
    name: 'Iron Skin',
    description: '+10 Defense. Shrug off incoming hits.',
    requiredLevel: 3,
    effect: { stats: { defense: 10 } },
  },
  {
    code: 'sharpshooter',
    name: 'Sharpshooter',
    description: '+10 Accuracy. Land critical hits more often.',
    requiredLevel: 6,
    effect: { stats: { accuracy: 10 } },
  },
  {
    code: 'berserker',
    name: 'Berserker',
    description: '+15 Strength, but -5 Defense. Hit harder, take more.',
    requiredLevel: 6,
    effect: { stats: { strength: 15, defense: -5 } },
  },
  {
    code: 'critical_mastery',
    name: 'Critical Mastery',
    description: '+25% Critical Damage. Crits hit devastatingly hard.',
    requiredLevel: 9,
    effect: { stats: { criticalDamage: 25 } },
  },
  {
    code: 'survivor',
    name: 'Survivor',
    description: '+10 Endurance and +10% Health Regeneration.',
    requiredLevel: 9,
    effect: { stats: { endurance: 10 }, healthRegenBonus: 0.1 },
  },
];

export const PERK_BY_CODE = new Map(PERK_DEFINITIONS.map((p) => [p.code, p]));

// A perk point is granted every 3 levels.
export function perkPointsForLevel(level: number): number {
  return Math.floor(level / 3);
}
