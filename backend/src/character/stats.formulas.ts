// Pure combat math with no service/Prisma dependencies, so the battle engine
// can stay free of I/O imports (and unit-testable without a database).

import { GAME_CONFIG } from '../config/game.config';

// Fraction of incoming damage removed by a given defense value
// (0..maxDamageReduction).
export function damageReduction(defense: number): number {
  const d = Math.max(0, defense);
  return Math.min(GAME_CONFIG.combat.maxDamageReduction, d / (d + 100));
}
