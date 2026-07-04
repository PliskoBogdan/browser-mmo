// Pure combat math with no service/Prisma dependencies, so the battle engine
// can stay free of I/O imports (and unit-testable without a database).

const MAX_DAMAGE_REDUCTION = 0.7;

// Fraction of incoming damage removed by a given defense value (0..0.7).
export function damageReduction(defense: number): number {
  const d = Math.max(0, defense);
  return Math.min(MAX_DAMAGE_REDUCTION, d / (d + 100));
}
