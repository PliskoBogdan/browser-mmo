import type { CombatEffectDef } from '@my/shared';

// Player combat skills. Like perks, skills are game content and live in code.
// Every character with a weapon has the full base kit; the interesting choices
// come from momentum economy, cooldowns and reacting to the monster's intent.

export const MAX_MOMENTUM = 5;

export interface SkillDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  // Damage as a percentage of the player's attack damage. 0 = utility skill.
  damagePercent: number;
  momentumCost: number;
  momentumGain: number;
  // Per-skill cooldown as a multiple of the weapon's attack cooldown. Every
  // skill also respects the global weapon cooldown between actions.
  cooldownMult: number;
  // Extra on-use effects (statuses etc.), applied only if the skill resolves.
  effects?: CombatEffectDef[];
  // Cancels a telegraphed HEAVY intent back to a normal attack.
  interruptsHeavy?: boolean;
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    code: 'strike',
    name: 'Strike',
    description: 'A reliable weapon strike. Builds 1 momentum.',
    icon: 'mdi-sword',
    damagePercent: 100,
    momentumCost: 0,
    momentumGain: 1,
    cooldownMult: 1,
  },
  {
    code: 'rend',
    name: 'Rend',
    description: 'A tearing cut: 65% damage, inflicts Bleeding (2 stacks, 3 ticks). Builds 1 momentum.',
    icon: 'mdi-knife-military',
    damagePercent: 65,
    momentumCost: 0,
    momentumGain: 1,
    cooldownMult: 2,
    effects: [{ type: 'APPLY_STATUS', target: 'MONSTER', status: 'bleed', stacks: 2, ticks: 3 }],
  },
  {
    code: 'heavy_blow',
    name: 'Heavy Blow',
    description: 'Spend 3 momentum: 220% damage, 35% chance to stun. Interrupts a telegraphed heavy attack.',
    icon: 'mdi-hammer',
    damagePercent: 220,
    momentumCost: 3,
    momentumGain: 0,
    cooldownMult: 1,
    interruptsHeavy: true,
    effects: [{ type: 'APPLY_STATUS', target: 'MONSTER', status: 'stun', stacks: 1, ticks: 2, chance: 0.35 }],
  },
  {
    code: 'guard',
    name: 'Guard',
    description: 'Brace yourself: block 60% of incoming damage for the next 2 enemy ticks.',
    icon: 'mdi-shield',
    damagePercent: 0,
    momentumCost: 0,
    momentumGain: 0,
    cooldownMult: 2,
    effects: [{ type: 'APPLY_STATUS', target: 'PLAYER', status: 'guard', stacks: 1, ticks: 2 }],
  },
  {
    code: 'dodge_stance',
    name: 'Dodge Stance',
    description: 'Focus on footwork: evasion doubled for the next 2 enemy ticks.',
    icon: 'mdi-run-fast',
    damagePercent: 0,
    momentumCost: 0,
    momentumGain: 0,
    cooldownMult: 3,
    effects: [{ type: 'APPLY_STATUS', target: 'PLAYER', status: 'dodge_stance', stacks: 1, ticks: 2 }],
  },
];

export const SKILL_BY_CODE = new Map(SKILL_DEFINITIONS.map((s) => [s.code, s]));
