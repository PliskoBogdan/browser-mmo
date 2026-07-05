import type { CoreStat, EquipmentSlot, ItemRarity } from '~/stores/character';
import type { Character } from '~/stores/character';

export interface ShopCatalogEntry {
  itemId: number;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  description: string | null;
  icon: string | null;
  baseDamage: number;
  attackSpeed: number | null;
  modifiers: Partial<Record<CoreStat, number>>;
  price: number;
  minLevel: number;
  canAfford: boolean;
  meetsLevel: boolean;
}

// A consumable (e.g. Torch) a shop sells — no slot/level gate, just gold.
export interface ShopConsumableEntry {
  itemId: number;
  name: string;
  description: string | null;
  rarity: ItemRarity;
  price: number;
  canAfford: boolean;
}

export const useShopStore = defineStore('shop', () => {
  const catalog = ref<ShopCatalogEntry[]>([]);
  const consumables = ref<ShopConsumableEntry[]>([]);
  const loading = ref(false);

  async function fetchCatalog(subLocationId: number) {
    loading.value = true;
    try {
      const { request } = useApi();
      const data = await request<{ equipment: ShopCatalogEntry[]; items: ShopConsumableEntry[] }>(`/shop/${subLocationId}`);
      catalog.value = data.equipment;
      consumables.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  async function buy(subLocationId: number, equipmentItemId: number) {
    const { request } = useApi();
    const character = await request<Character>(`/shop/${subLocationId}/buy`, {
      method: 'POST',
      body: { equipmentItemId },
    });
    const characterStore = useCharacterStore();
    characterStore.character = character;
    await Promise.all([fetchCatalog(subLocationId), characterStore.fetchGear()]);
    return character;
  }

  async function buyItem(subLocationId: number, itemId: number) {
    const { request } = useApi();
    const result = await request<{ message: string }>(`/shop/${subLocationId}/buy-item`, {
      method: 'POST',
      body: { itemId },
    });
    const characterStore = useCharacterStore();
    await Promise.all([fetchCatalog(subLocationId), characterStore.fetch()]);
    return result;
  }

  function clear() {
    catalog.value = [];
    consumables.value = [];
  }

  return { catalog, consumables, loading, fetchCatalog, buy, buyItem, clear };
});
