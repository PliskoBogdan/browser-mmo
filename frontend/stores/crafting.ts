// Mirrors of shared/src/interfaces/crafting.interface.ts (kept local like the
// other stores).

import type { CoreStat, EquipmentSlot, ItemRarity } from '~/stores/character';

export interface CraftIngredientView {
  itemId: number;
  name: string;
  rarity: ItemRarity;
  required: number;
  owned: number;
}

export interface CraftResultView {
  kind: 'EQUIPMENT' | 'ITEM';
  name: string;
  rarity: ItemRarity;
  description: string | null;
  quantity: number;
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
  canCraft: boolean;
}

export interface CraftOutcome {
  message: string;
  recipeId: number;
  gold: number;
}

export const useCraftingStore = defineStore('crafting', () => {
  const recipes = ref<CraftRecipeView[]>([]);
  const loading = ref(false);

  async function fetchRecipes(subLocationId: number) {
    loading.value = true;
    try {
      const { request } = useApi();
      recipes.value = await request<CraftRecipeView[]>(`/crafting/${subLocationId}`);
    } finally {
      loading.value = false;
    }
  }

  async function craft(subLocationId: number, recipeId: number) {
    const { request } = useApi();
    const result = await request<CraftOutcome>(`/crafting/${subLocationId}/craft`, {
      method: 'POST',
      body: { recipeId },
    });
    const characterStore = useCharacterStore();
    // Re-pull recipes (owned counts changed), character (gold), and gear in
    // case the forged piece should show up on the equipment screen.
    await Promise.all([fetchRecipes(subLocationId), characterStore.fetch(), characterStore.fetchGear()]);
    return result;
  }

  function clear() {
    recipes.value = [];
  }

  return { recipes, loading, fetchRecipes, craft, clear };
});
