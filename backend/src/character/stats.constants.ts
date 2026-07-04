import type { CoreStat, EquipmentSlot } from '@my/shared';

// Runtime constants mirrored locally. @my/shared is consumed as *types only*
// (which the compiler erases); importing its runtime values would make Node try
// to load the package's raw TypeScript source at runtime, which it can't do.
export const CORE_STATS: CoreStat[] = ['strength', 'agility', 'accuracy', 'endurance', 'criticalDamage', 'defense'];

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['WEAPON', 'HELMET', 'BODY', 'PANTS', 'GLOVES'];
