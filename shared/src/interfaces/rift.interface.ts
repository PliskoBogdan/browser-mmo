// Rifts: procedurally generated, shared, expiring dungeons with fog of war
// and an extraction loot loop.

export type RiftTileKind = 'ENTRANCE' | 'PATH' | 'MONSTER' | 'BOSS' | 'RESOURCE' | 'CHEST' | 'LOCKED' | 'DARK';

// What the client sees for a single tile. Unexplored tiles adjacent to explored
// ones are sent as FOG frontier cells: coordinates only, contents hidden —
// except gates (LOCKED/DARK), which reveal what item they need so the player
// knows what to hunt for.
export type RiftTileViewKind = RiftTileKind | 'FOG';

export interface RiftTileView {
  x: number;
  y: number;
  kind: RiftTileViewKind;
  explored: boolean;
  name?: string;
  depth?: number;
  // Groups tiles into the same visual room; null/undefined = bare corridor.
  roomId?: number | null;
  requiredItemName?: string;
  monsterName?: string;
  monsterAlive?: boolean;
  resourceItemName?: string;
  resourceRarity?: string;
  charges?: number;
  goldReward?: number; // CHEST only, revealed once opened
}

export interface RiftLootEntry {
  itemId: number;
  name: string;
  rarity: string;
  quantity: number;
}

// A rift as it appears on the overworld map — a node alongside Locations,
// reached by walking to its cell (see LocationService.getWorldMap/moveOnWorld).
export interface RiftWorldNode {
  id: number;
  name: string;
  tier: number;
  minLevel: number;
  mapX: number;
  mapY: number;
  expiresAt: string;
  locked: boolean;
}

export interface RiftView {
  id: number;
  name: string;
  tier: number;
  gridWidth: number;
  gridHeight: number;
  expiresAt: string;
  position: { x: number; y: number };
  // Only explored tiles + fog frontier — never the full map.
  tiles: RiftTileView[];
  lootBag: RiftLootEntry[];
  // Gate-opening tools currently owned (real inventory, not the rift bag) —
  // shown so the player knows what they can open before reaching a gate.
  keyItems: { name: string; quantity: number }[];
}

export interface RiftMoveResult {
  view: RiftView;
  // Human-readable events for the move (exp gained, gate opened, ...).
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
