interface Weapon {
  id: number;
  name: string;
  damage: number;
  attackSpeed: number;
}

interface Equipment {
  primaryWeapon: Weapon | null;
  secondaryWeapon: Weapon | null;
}

export interface Character {
  id: number;
  username: string;
  email: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
  position: { locationId: number | null; x: number; y: number };
  equipment: Equipment | null;
  attackCooldownMs: number | null;
  createdAt: string;
}

export const useCharacterStore = defineStore('character', () => {
  const character = ref<Character | null>(null);
  const loading = ref(false);

  async function fetch() {
    loading.value = true;
    try {
      const { request } = useApi();
      character.value = await request<Character>('/character/me');
    } finally {
      loading.value = false;
    }
  }

  async function resurrect() {
    const { request } = useApi();
    await request('/character/resurrect', { method: 'POST' });
    await fetch();
  }

  function clear() {
    character.value = null;
  }

  return { character, loading, fetch, resurrect, clear };
});
