import type { CombatTriggerDef, IntentKind } from '@my/shared';

// Monster behaviour profiles. `Monster.aiProfile` selects one; monsters with
// no profile use BASIC (plain attacker). Intents are rolled per tick from the
// weights; triggers use the same event/effect system as player perks, with
// absolute targets (PLAYER / MONSTER).

export const HEAVY_DAMAGE_MULT = 1.8;

export interface MonsterAiProfile {
  code: string;
  intents: { kind: IntentKind; weight: number }[];
  triggers: CombatTriggerDef[];
}

const BASIC: MonsterAiProfile = {
  code: 'basic',
  intents: [{ kind: 'ATTACK', weight: 100 }],
  triggers: [],
};

// Beasts: reckless heavy swings, go berserk when wounded.
const FERAL: MonsterAiProfile = {
  code: 'feral',
  intents: [
    { kind: 'ATTACK', weight: 70 },
    { kind: 'HEAVY', weight: 30 },
  ],
  triggers: [
    {
      id: 'feral_enrage',
      on: 'MONSTER_HP_BELOW_50',
      oncePerBattle: true,
      effects: [{ type: 'APPLY_STATUS', target: 'MONSTER', status: 'enrage', stacks: 1, ticks: 3 }],
    },
  ],
};

// Humanoids: mix in defense, wear the player down with dirty tricks.
const CUNNING: MonsterAiProfile = {
  code: 'cunning',
  intents: [
    { kind: 'ATTACK', weight: 55 },
    { kind: 'HEAVY', weight: 20 },
    { kind: 'DEFEND', weight: 25 },
  ],
  triggers: [
    {
      id: 'cunning_dirty_blow',
      on: 'MONSTER_HIT',
      everyNth: 4,
      effects: [{ type: 'APPLY_STATUS', target: 'PLAYER', status: 'weaken', stacks: 1, ticks: 2 }],
    },
  ],
};

// Toxic creatures: every few landed hits poison the player.
const VENOMOUS: MonsterAiProfile = {
  code: 'venomous',
  intents: [
    { kind: 'ATTACK', weight: 80 },
    { kind: 'DEFEND', weight: 20 },
  ],
  triggers: [
    {
      id: 'venomous_bite',
      on: 'MONSTER_HIT',
      everyNth: 3,
      effects: [{ type: 'APPLY_STATUS', target: 'PLAYER', status: 'poison', stacks: 2, ticks: 3 }],
    },
  ],
};

export const MONSTER_AI_PROFILES: Record<string, MonsterAiProfile> = {
  basic: BASIC,
  feral: FERAL,
  cunning: CUNNING,
  venomous: VENOMOUS,
};

export function resolveAiProfile(aiProfile: string | null | undefined): MonsterAiProfile {
  return (aiProfile && MONSTER_AI_PROFILES[aiProfile]) || BASIC;
}
