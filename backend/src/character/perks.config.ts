import type { PerkDefinition } from '@my/shared';
import { GAME_CONFIG } from '../config/game.config';

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

  // --- Reactive perks (combat triggers) ---
  // These do nothing to base stats; they hook into combat events and are
  // resolved by the battle engine (battle/engine/engine.ts).
  {
    code: 'riposte',
    name: 'Riposte',
    description: 'After evading an attack, your next strike deals +50% damage.',
    requiredLevel: 3,
    effect: {},
    triggers: [
      {
        id: 'perk_riposte',
        on: 'PLAYER_EVADE',
        effects: [{ type: 'APPLY_STATUS', target: 'PLAYER', status: 'riposte', stacks: 1, ticks: -1 }],
      },
    ],
  },
  {
    code: 'bloodletter',
    name: 'Bloodletter',
    description: 'Critical hits have a 40% chance to inflict Bleeding (2 stacks).',
    requiredLevel: 6,
    effect: {},
    triggers: [
      {
        id: 'perk_bloodletter',
        on: 'PLAYER_CRIT',
        chance: 0.4,
        effects: [{ type: 'APPLY_STATUS', target: 'MONSTER', status: 'bleed', stacks: 2, ticks: 3 }],
      },
    ],
  },
  {
    code: 'combat_flow',
    name: 'Combat Flow',
    description: 'Every 3rd landed hit grants +1 momentum.',
    requiredLevel: 6,
    effect: {},
    triggers: [
      {
        id: 'perk_combat_flow',
        on: 'PLAYER_HIT',
        everyNth: 3,
        effects: [{ type: 'GAIN_MOMENTUM', amount: 1 }],
      },
    ],
  },
  {
    code: 'bloodlust',
    name: 'Bloodlust',
    description: 'Slaying a monster restores 10% of your max HP.',
    requiredLevel: 9,
    effect: {},
    triggers: [
      {
        id: 'perk_bloodlust',
        on: 'MONSTER_KILLED',
        effects: [{ type: 'HEAL_PLAYER', percentOfMax: 10 }],
      },
    ],
  },
  {
    code: 'second_wind',
    name: 'Second Wind',
    description: 'Once per battle, dropping below 30% HP instantly restores 15% of your max HP.',
    requiredLevel: 12,
    effect: {},
    triggers: [
      {
        id: 'perk_second_wind',
        on: 'PLAYER_HP_BELOW_30',
        oncePerBattle: true,
        effects: [{ type: 'HEAL_PLAYER', percentOfMax: 15 }],
      },
    ],
  },
];

export const PERK_BY_CODE = new Map(PERK_DEFINITIONS.map((p) => [p.code, p]));

// A perk point is granted every GAME_CONFIG.leveling.levelsPerPerkPoint levels.
export function perkPointsForLevel(level: number): number {
  return Math.floor(level / GAME_CONFIG.leveling.levelsPerPerkPoint);
}
