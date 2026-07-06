import { GAME_CONFIG } from '../config/game.config';

// Shared leveling curve, used by both battle rewards and rift exploration exp.
// The multiplier is tuned in GAME_CONFIG.leveling.

// Exp needed to finish the given level.
export function expToNextLevel(level: number): number {
  return level * GAME_CONFIG.leveling.expPerLevelMultiplier;
}

export function calculateLevelUp(currentLevel: number, totalExp: number): { level: number; remainingExp: number } {
  let level = currentLevel;
  let exp = totalExp;
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
  }
  return { level, remainingExp: exp };
}
