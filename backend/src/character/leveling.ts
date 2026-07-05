// Shared leveling curve: the exp needed to finish level N is N * 100.
// Used by both battle rewards and rift exploration exp.
export const EXP_PER_LEVEL_MULTIPLIER = 100;

export function calculateLevelUp(currentLevel: number, totalExp: number): { level: number; remainingExp: number } {
  let level = currentLevel;
  let exp = totalExp;
  while (exp >= level * EXP_PER_LEVEL_MULTIPLIER) {
    exp -= level * EXP_PER_LEVEL_MULTIPLIER;
    level++;
  }
  return { level, remainingExp: exp };
}
