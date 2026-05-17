interface Monster {
  id: number;
  name: string;
  maxHp: number;
  damage: number;
  attackSpeed: number;
}

interface SubLocationMonster {
  spawnWeight: number;
  monster: Monster;
}

export interface SubLocation {
  id: number;
  name: string;
  description: string | null;
  isSafe: boolean;
  minLevel: number;
  monsters: SubLocationMonster[];
}

export interface Location {
  id: number;
  name: string;
  description: string | null;
  minLevel: number;
  subLocations: SubLocation[];
}

export const useWorldStore = defineStore('world', () => {
  const locations = ref<Location[]>([]);
  const loading = ref(false);

  async function fetchLocations() {
    loading.value = true;
    try {
      const { request } = useApi();
      locations.value = await request<Location[]>('/locations');
    } finally {
      loading.value = false;
    }
  }

  return { locations, loading, fetchLocations };
});
