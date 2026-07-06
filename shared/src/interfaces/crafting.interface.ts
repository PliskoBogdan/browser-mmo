// Crafting: FORGE sub-locations teach recipes that consume world-gathered
// materials (monster loot, rift resources, boss trophies) plus gold, and
// produce either a piece of gear or a stack of consumables.

import type { CoreStat, EquipmentSlot, ItemRarity } from './stats.interface';

export interface CraftIngredientView {
  itemId: number;
  name: string;
  rarity: ItemRarity;
  required: number;
  // How many the player currently holds — drives the have/need UI.
  owned: number;
}

// The forged result, shaped like a shop catalog entry so the client can render
// gear stats the same way. Consumable results carry only item fields.
export interface CraftResultView {
  kind: 'EQUIPMENT' | 'ITEM';
  name: string;
  rarity: ItemRarity;
  description: string | null;
  quantity: number;
  // EQUIPMENT only
  slot?: EquipmentSlot;
  icon?: string | null;
  baseDamage?: number;
  attackSpeed?: number | null;
  modifiers?: Partial<Record<CoreStat, number>>;
  equipMinLevel?: number;
}

export interface CraftRecipeView {
  recipeId: number;
  name: string;
  description: string | null;
  goldCost: number;
  minLevel: number;
  result: CraftResultView;
  ingredients: CraftIngredientView[];
  meetsLevel: boolean;
  canAfford: boolean;
  hasMaterials: boolean;
  // meetsLevel && canAfford && hasMaterials — what the Craft button binds to.
  canCraft: boolean;
}

export interface CraftOutcome {
  message: string;
  recipeId: number;
  // Refreshed gold after paying the recipe cost.
  gold: number;
}
