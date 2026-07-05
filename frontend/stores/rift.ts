// Mirrors of shared/src/interfaces/rift.interface.ts (kept local like the
// other stores).

export type RiftTileViewKind = 'ENTRANCE' | 'PATH' | 'MONSTER' | 'BOSS' | 'RESOURCE' | 'CHEST' | 'LOCKED' | 'DARK' | 'FOG';

export interface RiftTileView {
  x: number;
  y: number;
  kind: RiftTileViewKind;
  explored: boolean;
  name?: string;
  depth?: number;
  roomId?: number | null;
  requiredItemName?: string;
  monsterName?: string;
  monsterAlive?: boolean;
  resourceItemName?: string;
  resourceRarity?: string;
  charges?: number;
  goldReward?: number;
}

export interface RiftLootEntry {
  itemId: number;
  name: string;
  rarity: string;
  quantity: number;
}

export interface RiftView {
  id: number;
  name: string;
  tier: number;
  gridWidth: number;
  gridHeight: number;
  expiresAt: string;
  position: { x: number; y: number };
  tiles: RiftTileView[];
  lootBag: RiftLootEntry[];
  keyItems: { name: string; quantity: number }[];
}

export interface RiftMoveResult {
  view: RiftView;
  events: string[];
  expGained: number;
  leveledUp: boolean;
  battleStarted: boolean;
}

export interface RiftGatherResult {
  view: RiftView;
  gathered: RiftLootEntry | null;
  goldGained: number;
  message: string;
}

export interface RiftExtractResult {
  banked: RiftLootEntry[];
  message: string;
}

export const useRiftStore = defineStore('rift', () => {
  const activeRiftId = ref<number | null>(null);
  const view = ref<RiftView | null>(null);
  const loading = ref(false);

  async function enter(riftId: number) {
    const { request } = useApi();
    view.value = await request<RiftView>(`/rifts/${riftId}/enter`, { method: 'POST' });
    activeRiftId.value = riftId;
    return view.value;
  }

  async function fetchCurrent() {
    const { request } = useApi();
    const data = await request<{ run: RiftView | null }>('/rifts/current');
    view.value = data.run;
    activeRiftId.value = data.run?.id ?? null;
    return data.run;
  }

  async function move(x: number, y: number) {
    const { request } = useApi();
    const result = await request<RiftMoveResult>('/rifts/move', { method: 'POST', body: { x, y } });
    view.value = result.view;
    return result;
  }

  async function gather() {
    const { request } = useApi();
    const result = await request<RiftGatherResult>('/rifts/gather', { method: 'POST' });
    view.value = result.view;
    return result;
  }

  async function extract() {
    const { request } = useApi();
    const result = await request<RiftExtractResult>('/rifts/extract', { method: 'POST' });
    view.value = null;
    activeRiftId.value = null;
    return result;
  }

  function clear() {
    activeRiftId.value = null;
    view.value = null;
  }

  return { activeRiftId, view, loading, enter, fetchCurrent, move, gather, extract, clear };
});
