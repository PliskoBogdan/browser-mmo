// Pure, seeded rift map generator — no I/O, deterministic for a given seed so
// it can be unit-tested in isolation (see rift-generator.spec.ts).
//
// Layout strategy: stamp a handful of solid rectangular rooms (2x2 up to
// 6x6) across the grid, connect them with a minimum-spanning-tree of 1-wide
// corridors plus a few extra "loop" edges. Rooms carry a roomId so the
// client can render them as one visually distinct area (a highlighted floor
// + low walls around the room's bounding box); bare corridor tiles have
// roomId null and stay undecorated. Loops mean most corridors have an
// alternate route, so gates only end up on genuine bottlenecks (articulation
// points), and gates are kept apart from each other so two sealed doors
// never sit side by side. The deepest room not reachable without a gate
// becomes the boss's arena; a handful of the remaining rooms get a one-time
// treasure chest.

export type GeneratedTileKind = 'ENTRANCE' | 'PATH' | 'MONSTER' | 'BOSS' | 'RESOURCE' | 'CHEST' | 'LOCKED' | 'DARK';

export interface GeneratedTile {
  x: number;
  y: number;
  kind: GeneratedTileKind;
  name: string;
  depth: number;
  roomId: number | null; // null = bare corridor tile, not part of a room
  // Slot indices are resolved to DB rows by the caller using the tier config.
  monsterSlot?: 0 | 1;
  resourceSlot?: 0 | 1;
  maxCharges?: number;
  goldReward?: number; // CHEST only
}

export interface GeneratedRift {
  width: number;
  height: number;
  entranceX: number;
  entranceY: number;
  maxDepth: number;
  tiles: GeneratedTile[];
}

// mulberry32 — small deterministic PRNG, good enough for map layout.
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOM_ADJECTIVES = ['Mossy', 'Collapsed', 'Silent', 'Flooded', 'Overgrown', 'Shattered', 'Gloomy', 'Ancient', 'Withered', 'Echoing'];
const ROOM_NOUNS = ['Hollow', 'Glade', 'Gallery', 'Chamber', 'Alcove', 'Clearing', 'Grotto', 'Sanctum', 'Vault', 'Den'];
const CORRIDOR_NAMES = ['Narrow Passage', 'Winding Tunnel', 'Cramped Corridor', 'Damp Tunnel', 'Crumbling Walkway'];

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

const ROOM_MIN_SIZE = 2;
const ROOM_MAX_SIZE = 6;
// Gates (and the boss/chest budget) key off room count/size, so keep these
// tunables together rather than scattering magic numbers through the file.
const MIN_PRE_GATE_MONSTERS = 2;
const MIN_PRE_GATE_RESOURCES = 1;
const MIN_TOTAL_MONSTERS = 3;
const MIN_TOTAL_RESOURCES = 2;
const CHEST_ROOM_CHANCE = 0.5;
// Two sealed doors sitting next to each other reads as a glitch, not a real
// choke point — keep them at least this many tiles apart.
const MIN_GATE_SPACING = 3;

export function generateRift(seed: number, size: number): GeneratedRift {
  const rng = createRng(seed);
  const width = size;
  const height = size;
  const key = (x: number, y: number) => y * width + x;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  const entranceX = Math.floor(width / 2);
  const entranceY = height - 1;

  const { carved, roomIdByKey } = carveRoomsAndCorridors(rng, width, height, entranceX, entranceY, inBounds, key);

  // --- BFS depth from the entrance over the carved graph ---
  const depth = new Map<number, number>([[key(entranceX, entranceY), 0]]);
  const queue: [number, number][] = [[entranceX, entranceY]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const d = depth.get(key(x, y))!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (!inBounds(nx, ny) || !carved.has(k) || depth.has(k)) continue;
      depth.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }

  const cells = [...depth.entries()].map(([k, d]) => ({ x: k % width, y: Math.floor(k / width), depth: d }));
  const maxDepth = Math.max(...cells.map((c) => c.depth));

  // --- Gates: articulation points whose removal cuts off a deeper region ---
  const articulation = findArticulationPoints(cells, key);
  const gateCandidates = cells
    .filter((c) => c.depth > 0 && c.depth >= maxDepth * 0.35 && c.depth <= maxDepth * 0.8)
    .filter((c) => articulation.has(key(c.x, c.y)))
    .sort((a, b) => a.depth - b.depth);

  const gates = new Map<number, 'LOCKED' | 'DARK'>();
  const chosenGateCoords: { x: number; y: number }[] = [];
  const wantedGates = Math.min(2, gateCandidates.length);
  for (let i = 0; i < wantedGates; i++) {
    const startIdx = Math.floor((i + rng() * 0.99) * (gateCandidates.length / wantedGates));
    for (let offset = 0; offset < gateCandidates.length; offset++) {
      const cand = gateCandidates[(startIdx + offset) % gateCandidates.length];
      if (gates.has(key(cand.x, cand.y))) continue;
      if (chosenGateCoords.some((c) => Math.abs(c.x - cand.x) + Math.abs(c.y - cand.y) < MIN_GATE_SPACING)) continue;
      gates.set(key(cand.x, cand.y), rng() < 0.5 ? 'LOCKED' : 'DARK');
      chosenGateCoords.push(cand);
      break;
    }
  }

  // Reachable set treating gates as impassable — this is exactly what a
  // player with no key/torch can explore.
  const preGateReachable = reachableFrom(cells, key, entranceX, entranceY, new Set(gates.keys()));

  // --- Assign base tile kinds (entrance/gates only — room content is a
  // separate room-budgeted pass below, not an independent per-tile roll,
  // otherwise a 6x6 room could roll half a dozen monsters at once) ---
  const tiles: GeneratedTile[] = [];
  const roomCellsByRoom = new Map<number, { x: number; y: number; depth: number }[]>();

  for (const cell of cells.sort((a, b) => a.depth - b.depth)) {
    const k = key(cell.x, cell.y);
    const roomId = roomIdByKey.get(k) ?? null;
    const name = roomId !== null ? `${ROOM_ADJECTIVES[Math.floor(rng() * ROOM_ADJECTIVES.length)]} ${ROOM_NOUNS[Math.floor(rng() * ROOM_NOUNS.length)]}` : CORRIDOR_NAMES[Math.floor(rng() * CORRIDOR_NAMES.length)];
    const base: GeneratedTile = { x: cell.x, y: cell.y, depth: cell.depth, kind: 'PATH', name, roomId };

    if (cell.depth === 0) {
      tiles.push({ ...base, kind: 'ENTRANCE', name: 'Rift Entrance', roomId: null });
      continue;
    }
    const gate = gates.get(k);
    if (gate) {
      tiles.push({ ...base, kind: gate, name: gate === 'LOCKED' ? 'Sealed Door' : 'Pitch-Black Cave' });
      continue;
    }

    tiles.push(base);
    if (roomId !== null) {
      if (!roomCellsByRoom.has(roomId)) roomCellsByRoom.set(roomId, []);
      roomCellsByRoom.get(roomId)!.push(cell);
    }
  }

  const byKey = new Map(tiles.map((t) => [key(t.x, t.y), t]));

  // Content budget per room — capped so even a 6x6 room reads as "one big
  // room with a couple of things in it", not a monster closet.
  for (const [, roomCells] of roomCellsByRoom) {
    const budget = Math.min(4, Math.max(1, Math.round(roomCells.length / 6)));
    const shuffled = [...roomCells].sort(() => rng() - 0.5);
    let placed = 0;
    for (const cell of shuffled) {
      if (placed >= budget) break;
      const t = byKey.get(key(cell.x, cell.y))!;
      const deep = cell.depth > maxDepth * 0.5;
      if (rng() < 0.6) {
        t.kind = 'MONSTER';
        t.monsterSlot = deep ? 1 : 0;
      } else {
        const rare = cell.depth > maxDepth * 0.75;
        t.kind = 'RESOURCE';
        t.resourceSlot = rare ? 1 : 0;
        t.maxCharges = 2 + Math.floor(rng() * 3);
      }
      placed++;
    }
  }

  // Force minimums onto the deepest tiles, preferring tiles reachable WITHOUT
  // any gate first — a rift must always offer something to do even if the
  // player never finds a key or torch. Room tiles are tried first (content
  // belongs in rooms); if a pool has no room tiles at all (e.g. the shallow
  // pre-gate area is corridor-only), bare corridor tiles are used instead —
  // meeting the minimum matters more than the room-only preference here.
  const plainSortedBy = (pool: Set<number>, roomOnly: boolean) => tiles.filter((t) => t.kind === 'PATH' && pool.has(key(t.x, t.y)) && (!roomOnly || t.roomId !== null)).sort((a, b) => b.depth - a.depth);
  const countIn = (kind: GeneratedTileKind, pool: Set<number>) => [...pool].filter((k) => byKey.get(k)?.kind === kind).length;

  function forceMinimum(kind: 'MONSTER' | 'RESOURCE', want: number, pool: Set<number>): void {
    let count = countIn(kind, pool);
    for (const roomOnly of [true, false]) {
      for (const t of plainSortedBy(pool, roomOnly)) {
        if (count >= want) return;
        if (kind === 'MONSTER') {
          t.kind = 'MONSTER';
          t.monsterSlot = t.depth > maxDepth * 0.5 ? 1 : 0;
        } else {
          t.kind = 'RESOURCE';
          t.resourceSlot = t.depth > maxDepth * 0.75 ? 1 : 0;
          t.maxCharges = 2 + Math.floor(rng() * 3);
        }
        count++;
      }
    }
  }

  const allCells = new Set(cells.map((c) => key(c.x, c.y)));

  // --- Boss: the deepest room, preferring one locked behind a gate. Placed
  // before the minimum-content pass below so a monster/resource forced into
  // its arena during that pass can't survive the arena-clearing step. ---
  const bossRoomId = placeBoss(tiles, preGateReachable, key);
  const nonBossCells = bossRoomId === null ? allCells : new Set([...allCells].filter((k) => byKey.get(k)?.roomId !== bossRoomId));
  const nonBossPreGate = bossRoomId === null ? preGateReachable : new Set([...preGateReachable].filter((k) => byKey.get(k)?.roomId !== bossRoomId));

  forceMinimum('MONSTER', MIN_PRE_GATE_MONSTERS, nonBossPreGate);
  forceMinimum('RESOURCE', MIN_PRE_GATE_RESOURCES, nonBossPreGate);
  forceMinimum('MONSTER', MIN_TOTAL_MONSTERS, nonBossCells);
  forceMinimum('RESOURCE', MIN_TOTAL_RESOURCES, nonBossCells);

  // --- Chests: one-time treasure in a handful of the remaining rooms ---
  placeChests(rng, tiles);

  return { width, height, entranceX, entranceY, maxDepth, tiles };
}

function placeBoss(tiles: GeneratedTile[], preGateReachable: Set<number>, key: (x: number, y: number) => number): number | null {
  const roomIds = new Set(tiles.map((t) => t.roomId).filter((id): id is number => id !== null));
  if (!roomIds.size) return null; // pathological tiny map with no rooms — skip, still playable

  const roomTiles = (roomId: number) => tiles.filter((t) => t.roomId === roomId);
  const roomMaxDepth = new Map([...roomIds].map((id) => [id, Math.max(...roomTiles(id).map((t) => t.depth))]));
  const isGated = (roomId: number) => !roomTiles(roomId).some((t) => preGateReachable.has(key(t.x, t.y)));

  const gatedRoomIds = [...roomIds].filter(isGated);
  const candidates = gatedRoomIds.length ? gatedRoomIds : [...roomIds];
  const bossRoomId = candidates.sort((a, b) => roomMaxDepth.get(b)! - roomMaxDepth.get(a)!)[0];

  const arena = roomTiles(bossRoomId);
  const bossTile = arena.sort((a, b) => b.depth - a.depth)[0];
  bossTile.kind = 'BOSS';
  bossTile.name = 'Boss Lair';
  delete bossTile.monsterSlot;
  delete bossTile.resourceSlot;
  delete bossTile.maxCharges;

  // Keep the arena clear of distractions — everything else in the room
  // reverts to plain floor so the boss fight reads as a dedicated encounter.
  for (const t of arena) {
    if (t === bossTile) continue;
    if (t.kind === 'MONSTER' || t.kind === 'RESOURCE' || t.kind === 'CHEST') {
      t.kind = 'PATH';
      delete t.monsterSlot;
      delete t.resourceSlot;
      delete t.maxCharges;
      delete t.goldReward;
    }
  }
  return bossRoomId;
}

function placeChests(rng: () => number, tiles: GeneratedTile[]): void {
  const bossRoomId = tiles.find((t) => t.kind === 'BOSS')?.roomId ?? null;
  const roomIds = new Set(tiles.map((t) => t.roomId).filter((id): id is number => id !== null && id !== bossRoomId));

  const chestGold = (depth: number) => 10 + depth * 4 + Math.floor(rng() * 10);
  let chestCount = 0;

  for (const roomId of roomIds) {
    if (rng() >= CHEST_ROOM_CHANCE) continue;
    const candidates = tiles.filter((t) => t.roomId === roomId && t.kind === 'PATH');
    if (!candidates.length) continue;
    const t = candidates[Math.floor(rng() * candidates.length)];
    t.kind = 'CHEST';
    t.maxCharges = 1;
    t.goldReward = chestGold(t.depth);
    chestCount++;
  }

  if (chestCount === 0) {
    const fallback = tiles.filter((t) => t.roomId !== null && t.roomId !== bossRoomId && t.kind === 'PATH').sort((a, b) => b.depth - a.depth);
    if (fallback.length) {
      const t = fallback[0];
      t.kind = 'CHEST';
      t.maxCharges = 1;
      t.goldReward = chestGold(t.depth);
    }
  }
}

// --- Room + corridor carving ---

// Picks a room footprint between ROOM_MIN_SIZE and ROOM_MAX_SIZE on each
// axis, weighted toward smaller/squarer rooms with big ones as rare
// showpieces — a 6x6 room every couple of rifts, not every room.
function pickRoomSize(rng: () => number): { w: number; h: number } {
  const roll = rng();
  let base: number;
  if (roll < 0.5) base = ROOM_MIN_SIZE;
  else if (roll < 0.8) base = 3;
  else if (roll < 0.93) base = 4;
  else base = 5 + Math.floor(rng() * 2); // 5 or 6

  const wExtra = rng() < 0.3 ? 1 : 0;
  const hExtra = rng() < 0.3 ? 1 : 0;
  return { w: Math.min(ROOM_MAX_SIZE, base + wExtra), h: Math.min(ROOM_MAX_SIZE, base + hExtra) };
}

function carveRoomsAndCorridors(rng: () => number, width: number, height: number, entranceX: number, entranceY: number, inBounds: (x: number, y: number) => boolean, key: (x: number, y: number) => number): { carved: Set<number>; roomIdByKey: Map<number, number> } {
  const carved = new Set<number>([key(entranceX, entranceY)]);
  const roomIdByKey = new Map<number, number>();
  let nextRoomId = 1;

  // A candidate rectangle is only accepted if it (plus a 1-cell buffer) is
  // entirely free — rooms never touch or overlap, so each one is a clearly
  // separate space joined only by an explicit corridor.
  function rectFree(x: number, y: number, w: number, h: number): boolean {
    for (let dy = -1; dy <= h; dy++) {
      for (let dx = -1; dx <= w; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (!inBounds(cx, cy)) continue;
        if (carved.has(key(cx, cy))) return false;
      }
    }
    return true;
  }

  function stampRoom(x: number, y: number, w: number, h: number): number {
    const roomId = nextRoomId++;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (!inBounds(cx, cy)) continue;
        const k = key(cx, cy);
        carved.add(k);
        roomIdByKey.set(k, roomId);
      }
    }
    return roomId;
  }

  function carveCorridor(a: { x: number; y: number }, b: { x: number; y: number }) {
    let x = a.x;
    let y = a.y;
    const horizontalFirst = rng() < 0.5;
    const stepX = () => {
      while (x !== b.x) {
        x += x < b.x ? 1 : -1;
        if (inBounds(x, y)) carved.add(key(x, y));
      }
    };
    const stepY = () => {
      while (y !== b.y) {
        y += y < b.y ? 1 : -1;
        if (inBounds(x, y)) carved.add(key(x, y));
      }
    };
    if (horizontalFirst) {
      stepX();
      stepY();
    } else {
      stepY();
      stepX();
    }
  }

  // Aim for total room coverage of ~40% of the grid — a handful of
  // substantial, clearly-separated rooms rather than many tiny ones.
  const roomCount = Math.max(3, Math.round((width * height * 0.42) / 9));
  const anchors: { x: number; y: number; roomId: number | null }[] = [{ x: entranceX, y: entranceY, roomId: null }];

  let attempts = 0;
  let placed = 0;
  while (placed < roomCount && attempts < roomCount * 120) {
    attempts++;
    const { w, h } = pickRoomSize(rng);
    const x = Math.floor(rng() * Math.max(1, width - w + 1));
    const y = Math.floor(rng() * Math.max(1, height - h + 1));
    if (!rectFree(x, y, w, h)) continue;
    const roomId = stampRoom(x, y, w, h);
    // Anchor at the room's center cell (rounded) so corridor connections
    // enter roughly in the middle of an edge rather than always a corner.
    anchors.push({ x: x + Math.floor(w / 2), y: y + Math.floor(h / 2), roomId });
    placed++;
  }

  // Connect every room to the entrance via a minimum-spanning tree (nearest
  // unconnected room each step) — guarantees full connectivity.
  const connected = new Set<number>([0]);
  const remaining = new Set(anchors.map((_, i) => i).filter((i) => i !== 0));
  while (remaining.size) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (const ci of connected) {
      for (const ri of remaining) {
        const d = Math.abs(anchors[ci].x - anchors[ri].x) + Math.abs(anchors[ci].y - anchors[ri].y);
        if (d < bestDist) {
          bestDist = d;
          best = [ci, ri];
        }
      }
    }
    if (!best) break;
    carveCorridor(anchors[best[0]], anchors[best[1]]);
    connected.add(best[1]);
    remaining.delete(best[1]);
  }

  // Extra "loop" edges between nearby rooms: alternate routes so the map
  // isn't a strict tree — most corridors stop being articulation points,
  // and exploring feels like a real cave with multiple ways around.
  const extraCount = Math.max(1, Math.floor(anchors.length * 0.3));
  for (let i = 0; i < extraCount; i++) {
    const a = anchors[Math.floor(rng() * anchors.length)];
    const b = anchors[Math.floor(rng() * anchors.length)];
    if (a === b) continue;
    const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (d > 9) continue; // keep loops local, not shortcuts across the whole map
    carveCorridor(a, b);
  }

  return { carved, roomIdByKey };
}

// BFS over `cells`, treating `blocked` keys as impassable walls. Used to find
// exactly what's reachable without needing any gate item.
function reachableFrom(cells: { x: number; y: number; depth: number }[], key: (x: number, y: number) => number, startX: number, startY: number, blocked: Set<number>): Set<number> {
  const known = new Set(cells.map((c) => key(c.x, c.y)));
  const seen = new Set<number>([key(startX, startY)]);
  const queue: [number, number][] = [[startX, startY]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = key(nx, ny);
      if (!known.has(nk) || seen.has(nk) || blocked.has(nk)) continue;
      seen.add(nk);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

// Tarjan articulation points over the carved-cell graph. Returns cell keys
// whose removal disconnects the map (excluding the root/entrance).
function findArticulationPoints(cells: { x: number; y: number; depth: number }[], key: (x: number, y: number) => number): Set<number> {
  const carved = new Set(cells.map((c) => key(c.x, c.y)));
  const disc = new Map<number, number>();
  const low = new Map<number, number>();
  const result = new Set<number>();
  let timer = 0;

  const root = cells.find((c) => c.depth === 0)!;
  const rootKey = key(root.x, root.y);

  // Iterative DFS to stay safe on larger maps.
  const stack: { k: number; x: number; y: number; parent: number; dirIndex: number; childCount: number }[] = [{ k: rootKey, x: root.x, y: root.y, parent: -1, dirIndex: 0, childCount: 0 }];
  disc.set(rootKey, timer);
  low.set(rootKey, timer);
  timer++;

  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.dirIndex < DIRS.length) {
      const [dx, dy] = DIRS[frame.dirIndex++];
      const nx = frame.x + dx;
      const ny = frame.y + dy;
      const nk = key(nx, ny);
      if (!carved.has(nk) || nk === frame.parent) continue;
      if (disc.has(nk)) {
        low.set(frame.k, Math.min(low.get(frame.k)!, disc.get(nk)!));
        continue;
      }
      frame.childCount++;
      disc.set(nk, timer);
      low.set(nk, timer);
      timer++;
      stack.push({ k: nk, x: nx, y: ny, parent: frame.k, dirIndex: 0, childCount: 0 });
    } else {
      stack.pop();
      const parent = stack[stack.length - 1];
      if (!parent) {
        if (frame.childCount > 1) result.add(frame.k); // root rule
        continue;
      }
      low.set(parent.k, Math.min(low.get(parent.k)!, low.get(frame.k)!));
      if (parent.k !== rootKey && low.get(frame.k)! >= disc.get(parent.k)!) {
        result.add(parent.k);
      }
    }
  }

  return result;
}
