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

export const useShopStore = defineStore('shop', () => {
  const catalog = ref<ShopCatalogEntry[]>([]);
  const loading = ref(false);

  async function fetchCatalog(subLocationId: number) {
    loading.value = true;
    try {
      const { request } = useApi();
      catalog.value = await request<ShopCatalogEntry[]>(`/shop/${subLocationId}`);
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

  function clear() {
    catalog.value = [];
  }

  return { catalog, loading, fetchCatalog, buy, clear };
});
