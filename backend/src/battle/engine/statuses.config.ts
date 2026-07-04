import type { StatusCode, StatusKind } from '@my/shared';

// Numeric behaviour of every status lives here (and in the resolver), while
// per-instance data (stacks, ticks, power) lives in BattleRuntimeState.

// Damage multipliers while the status is present.
export const GUARD_INCOMING_MULT = 0.4; // guard blocks 60% of incoming damage
export const WEAKEN_OUTGOING_MULT = 0.7;
export const ENRAGE_OUTGOING_MULT = 1.3;
export const RIPOSTE_DAMAGE_MULT = 1.5;
export const DODGE_STANCE_EVASION_MULT = 2;
export const MAX_EVASION_WITH_STANCE = 0.9;

// DoT power as a fraction of the applier's attack damage, per stack per tick.
export const BLEED_POWER_FRACTION = 0.15;
export const POISON_POWER_FRACTION = 0.25;

export interface StatusMeta {
  code: StatusCode;
  name: string;
  icon: string;
  kind: StatusKind;
  description: string;
}

export const STATUS_META: Record<StatusCode, StatusMeta> = {
  bleed: {
    code: 'bleed',
    name: 'Bleeding',
    icon: 'mdi-water',
    kind: 'DEBUFF',
    description: 'Takes damage every tick per stack.',
  },
  poison: {
    code: 'poison',
    name: 'Poisoned',
    icon: 'mdi-bottle-tonic-skull',
    kind: 'DEBUFF',
    description: 'Takes poison damage every tick per stack.',
  },
  stun: {
    code: 'stun',
    name: 'Stunned',
    icon: 'mdi-lightning-bolt',
    kind: 'DEBUFF',
    description: 'Skips its next attack (one per stack).',
  },
  weaken: {
    code: 'weaken',
    name: 'Weakened',
    icon: 'mdi-arm-flex-outline',
    kind: 'DEBUFF',
    description: 'Deals 30% less damage.',
  },
  enrage: {
    code: 'enrage',
    name: 'Enraged',
    icon: 'mdi-emoticon-angry',
    kind: 'BUFF',
    description: 'Deals 30% more damage.',
  },
  guard: {
    code: 'guard',
    name: 'Guarding',
    icon: 'mdi-shield',
    kind: 'BUFF',
    description: 'Blocks 60% of incoming damage.',
  },
  dodge_stance: {
    code: 'dodge_stance',
    name: 'Dodge Stance',
    icon: 'mdi-run-fast',
    kind: 'BUFF',
    description: 'Evasion chance doubled.',
  },
  riposte: {
    code: 'riposte',
    name: 'Riposte',
    icon: 'mdi-fencing',
    kind: 'BUFF',
    description: 'Next attack deals 50% more damage.',
  },
};
