export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE';

export interface InventoryEntry {
  itemId: number;
  name: string;
  description: string | null;
  rarity: ItemRarity;
  sellValue: number;
  staminaRestore: number | null;
  quantity: number;
}

export const useInventoryStore = defineStore('inventory', () => {
  const items = ref<InventoryEntry[]>([]);
  const loading = ref(false);

  async function fetchInventory() {
    loading.value = true;
    try {
      const { request } = useApi();
      items.value = await request<InventoryEntry[]>('/inventory');
    } finally {
      loading.value = false;
    }
  }

  async function sell(itemId: number, quantity: number) {
    const { request } = useApi();
    const result = await request<{ message: string; goldGained: number; remainingQuantity: number }>(`/inventory/${itemId}/sell`, {
      method: 'POST',
      body: { quantity },
    });

    const entry = items.value.find((i) => i.itemId === itemId);
    if (entry) {
      if (result.remainingQuantity > 0) {
        entry.quantity = result.remainingQuantity;
      } else {
        items.value = items.value.filter((i) => i.itemId !== itemId);
      }
    }

    return result;
  }

  // Eat a food item: consumes one and restores stamina.
  async function use(itemId: number) {
    const { request } = useApi();
    const result = await request<{ message: string; stamina: { stamina: number; maxStamina: number }; remainingQuantity: number }>(`/inventory/${itemId}/use`, {
      method: 'POST',
    });

    const entry = items.value.find((i) => i.itemId === itemId);
    if (entry) {
      if (result.remainingQuantity > 0) {
        entry.quantity = result.remainingQuantity;
      } else {
        items.value = items.value.filter((i) => i.itemId !== itemId);
      }
    }
    useCharacterStore().applyStamina(result.stamina);

    return result;
  }

  function clear() {
    items.value = [];
  }

  return { items, loading, fetchInventory, sell, use, clear };
});
