export type SubLocationKind = 'SAFE' | 'SHOP' | 'LOOT_SHOP' | 'DANGER';

export interface WorldLocationNode {
  id: number;
  name: string;
  description: string | null;
  minLevel: number;
  mapX: number;
  mapY: number;
  locked: boolean;
}

export interface OverworldMap {
  width: number;
  height: number;
  locations: WorldLocationNode[];
}

export interface SubLocationCell {
  id: number;
  name: string;
  description: string | null;
  kind: SubLocationKind;
  minLevel: number;
  gridX: number;
  gridY: number;
}

export interface LocationDetail {
  id: number;
  name: string;
  description: string | null;
  minLevel: number;
  gridWidth: number;
  gridHeight: number;
  subLocations: SubLocationCell[];
}

export interface Position {
  locationId: number | null;
  x: number;
  y: number;
}

export const useWorldStore = defineStore('world', () => {
  const overworld = ref<OverworldMap | null>(null);
  const currentLocation = ref<LocationDetail | null>(null);
  const position = ref<Position>({ locationId: null, x: 1, y: 2 });
  const loading = ref(false);
  const hydrated = ref(false);

  function hydratePosition(pos: Position) {
    position.value = pos;
  }

  // Only pulls position from the character store once per session (e.g. on a fresh
  // page load/refresh). After that, `position` is kept current by the move/enter/leave
  // actions below — re-hydrating from a stale cached character on every navigation
  // would clobber it and bounce the user back into whatever location they just left.
  async function ensureHydrated() {
    if (hydrated.value) return;
    const characterStore = useCharacterStore();
    if (!characterStore.character) await characterStore.fetch();
    if (characterStore.character) position.value = characterStore.character.position;
    hydrated.value = true;
  }

  async function fetchWorld() {
    loading.value = true;
    try {
      const { request } = useApi();
      overworld.value = await request<OverworldMap>('/locations/world');
    } finally {
      loading.value = false;
    }
  }

  async function fetchLocation(id: number) {
    loading.value = true;
    try {
      const { request } = useApi();
      currentLocation.value = await request<LocationDetail>(`/locations/${id}`);
    } finally {
      loading.value = false;
    }
  }

  async function moveOnWorld(x: number, y: number) {
    const { request } = useApi();
    const result = await request<{ position: { x: number; y: number }; location: WorldLocationNode | null }>('/locations/world/move', {
      method: 'POST',
      body: { x, y },
    });
    position.value = { locationId: null, x: result.position.x, y: result.position.y };
    return result.location;
  }

  async function enterLocation(id: number) {
    const { request } = useApi();
    const result = await request<{ locationId: number; position: { x: number; y: number } }>(`/locations/${id}/enter`, { method: 'POST' });
    position.value = { locationId: result.locationId, x: result.position.x, y: result.position.y };
  }

  async function moveInLocation(x: number, y: number) {
    const { request } = useApi();
    const result = await request<{ position: { x: number; y: number }; subLocation: SubLocationCell | null }>('/locations/move', {
      method: 'POST',
      body: { x, y },
    });
    position.value = { ...position.value, x: result.position.x, y: result.position.y };
    return result.subLocation;
  }

  async function leaveLocation() {
    const { request } = useApi();
    const result = await request<{ position: { x: number; y: number } }>('/locations/leave', { method: 'POST' });
    position.value = { locationId: null, x: result.position.x, y: result.position.y };
    currentLocation.value = null;
  }

  function clear() {
    overworld.value = null;
    currentLocation.value = null;
    position.value = { locationId: null, x: 1, y: 2 };
    hydrated.value = false;
  }

  return {
    overworld,
    currentLocation,
    position,
    loading,
    hydratePosition,
    ensureHydrated,
    fetchWorld,
    fetchLocation,
    moveOnWorld,
    enterLocation,
    moveInLocation,
    leaveLocation,
    clear,
  };
});
