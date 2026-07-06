export type SubLocationKind = 'SAFE' | 'SHOP' | 'LOOT_SHOP' | 'FORGE' | 'DANGER';

export interface WorldLocationNode {
  id: number;
  name: string;
  description: string | null;
  minLevel: number;
  mapX: number;
  mapY: number;
  locked: boolean;
}

// A rift as it appears on the overworld map — same grid as Locations, walked
// to and entered the same way.
export interface WorldRiftNode {
  id: number;
  name: string;
  tier: number;
  minLevel: number;
  mapX: number;
  mapY: number;
  expiresAt: string;
  locked: boolean;
}

export interface OverworldMap {
  width: number;
  height: number;
  locations: WorldLocationNode[];
  rifts: WorldRiftNode[];
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

export interface StaminaState {
  stamina: number;
  maxStamina: number;
}

export interface CampView {
  mapX: number;
  mapY: number;
  placedAt: string;
  expiresAt: string;
}

export interface CampStatus {
  camp: CampView | null;
  cooldownRemainingMs: number;
}

export interface PlaceCampResult {
  placed: boolean;
  ambushed: boolean;
  message: string;
  monsterName?: string;
  camp: CampView | null;
  stamina: StaminaState;
}

export const useWorldStore = defineStore('world', () => {
  const overworld = ref<OverworldMap | null>(null);
  const campStatus = ref<CampStatus | null>(null);
  // Wall-clock instant when a new camp can be placed (derived from the
  // fetch-time cooldownRemainingMs so the UI can count down locally).
  const campReadyAt = ref(0);
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
    const result = await request<{ position: { x: number; y: number }; location: WorldLocationNode | null; rift: WorldRiftNode | null; stamina: StaminaState }>('/locations/world/move', {
      method: 'POST',
      body: { x, y },
    });
    position.value = { locationId: null, x: result.position.x, y: result.position.y };
    useCharacterStore().applyStamina(result.stamina);
    return { location: result.location, rift: result.rift };
  }

  async function enterLocation(id: number) {
    const { request } = useApi();
    const result = await request<{ locationId: number; position: { x: number; y: number } }>(`/locations/${id}/enter`, { method: 'POST' });
    position.value = { locationId: result.locationId, x: result.position.x, y: result.position.y };
  }

  async function moveInLocation(x: number, y: number) {
    const { request } = useApi();
    const result = await request<{ position: { x: number; y: number }; subLocation: SubLocationCell | null; stamina: StaminaState | null }>('/locations/move', {
      method: 'POST',
      body: { x, y },
    });
    position.value = { ...position.value, x: result.position.x, y: result.position.y };
    useCharacterStore().applyStamina(result.stamina);
    return result.subLocation;
  }

  async function fetchCamp() {
    const { request } = useApi();
    campStatus.value = await request<CampStatus>('/camp');
    campReadyAt.value = Date.now() + campStatus.value.cooldownRemainingMs;
  }

  // Place a campfire on the current world cell. Either the fire is set (the
  // cell becomes the player's camp) or a wilderness ambush interrupts the
  // setup (the caller should route to /battle then).
  async function placeCamp() {
    const { request } = useApi();
    const result = await request<PlaceCampResult>('/camp', { method: 'POST' });
    if (result.placed) await fetchCamp();
    return result;
  }

  async function leaveLocation() {
    const { request } = useApi();
    const result = await request<{ position: { x: number; y: number } }>('/locations/leave', { method: 'POST' });
    position.value = { locationId: null, x: result.position.x, y: result.position.y };
    currentLocation.value = null;
  }

  function clear() {
    overworld.value = null;
    campStatus.value = null;
    campReadyAt.value = 0;
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
    campStatus,
    campReadyAt,
    fetchCamp,
    placeCamp,
    leaveLocation,
    clear,
  };
});
