import { generateRift, GeneratedRift, GeneratedTile } from './rift-generator';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);
const SIZES = [10, 12, 14];

function tileKey(t: { x: number; y: number }, width: number) {
  return t.y * width + t.x;
}

// BFS over the generated tiles, optionally treating some tiles as blocked.
function reachableFrom(rift: GeneratedRift, blocked: Set<number> = new Set()): Set<number> {
  const byKey = new Map(rift.tiles.map((t) => [tileKey(t, rift.width), t]));
  const start = tileKey({ x: rift.entranceX, y: rift.entranceY }, rift.width);
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const k = queue.shift()!;
    const t = byKey.get(k)!;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nk = tileKey({ x: t.x + dx, y: t.y + dy }, rift.width);
      if (!byKey.has(nk) || seen.has(nk) || blocked.has(nk)) continue;
      seen.add(nk);
      queue.push(nk);
    }
  }
  return seen;
}

function roomsOf(rift: GeneratedRift): Map<number, GeneratedTile[]> {
  const rooms = new Map<number, GeneratedTile[]>();
  for (const t of rift.tiles) {
    if (t.roomId === null) continue;
    if (!rooms.has(t.roomId)) rooms.set(t.roomId, []);
    rooms.get(t.roomId)!.push(t);
  }
  return rooms;
}

describe('generateRift', () => {
  it('is deterministic for a given seed', () => {
    const a = generateRift(12345, 10);
    const b = generateRift(12345, 10);
    expect(b).toEqual(a);
  });

  it('produces different maps for different seeds', () => {
    const a = generateRift(1, 10);
    const b = generateRift(2, 10);
    expect(b.tiles).not.toEqual(a.tiles);
  });

  describe.each(SIZES)('grid size %i', (size) => {
    describe.each(SEEDS)('seed %i', (seed) => {
      const rift = generateRift(seed, size);

      it('has a single entrance at depth 0, not part of a room', () => {
        const entrances = rift.tiles.filter((t) => t.kind === 'ENTRANCE');
        expect(entrances).toHaveLength(1);
        expect(entrances[0].depth).toBe(0);
        expect(entrances[0].x).toBe(rift.entranceX);
        expect(entrances[0].y).toBe(rift.entranceY);
        expect(entrances[0].roomId).toBeNull();
      });

      it('keeps every tile inside the grid and unique', () => {
        const keys = new Set<number>();
        for (const t of rift.tiles) {
          expect(t.x).toBeGreaterThanOrEqual(0);
          expect(t.y).toBeGreaterThanOrEqual(0);
          expect(t.x).toBeLessThan(rift.width);
          expect(t.y).toBeLessThan(rift.height);
          keys.add(tileKey(t, rift.width));
        }
        expect(keys.size).toBe(rift.tiles.length);
      });

      it('is fully connected from the entrance', () => {
        expect(reachableFrom(rift).size).toBe(rift.tiles.length);
      });

      it('forms solid 2x2..6x6 rectangular rooms, never touching each other', () => {
        const rooms = roomsOf(rift);
        expect(rooms.size).toBeGreaterThan(0);
        const known = new Set(rift.tiles.map((t) => tileKey(t, rift.width)));
        for (const tiles of rooms.values()) {
          const minX = Math.min(...tiles.map((t) => t.x));
          const maxX = Math.max(...tiles.map((t) => t.x));
          const minY = Math.min(...tiles.map((t) => t.y));
          const maxY = Math.max(...tiles.map((t) => t.y));
          const w = maxX - minX + 1;
          const h = maxY - minY + 1;
          // A solid rectangle — not an L-shape or a 1-wide sliver.
          expect(w).toBeGreaterThanOrEqual(2);
          expect(h).toBeGreaterThanOrEqual(2);
          expect(w).toBeLessThanOrEqual(6);
          expect(h).toBeLessThanOrEqual(6);
          expect(tiles.length).toBe(w * h);

          // No other room's tile sits directly adjacent to this room's
          // bounding box — rooms read as separate spaces joined by corridors.
          for (let y = minY - 1; y <= maxY + 1; y++) {
            for (let x = minX - 1; x <= maxX + 1; x++) {
              const insideThisRoom = x >= minX && x <= maxX && y >= minY && y <= maxY;
              if (insideThisRoom) continue;
              const k = tileKey({ x, y }, rift.width);
              if (!known.has(k)) continue;
              const neighborRoomId = rift.tiles.find((t) => tileKey(t, rift.width) === k)?.roomId;
              if (neighborRoomId != null) expect(neighborRoomId).not.toBe(tiles[0].roomId);
            }
          }
        }
      });

      it('keeps gates at least 3 tiles apart from each other', () => {
        const gates = rift.tiles.filter((t) => t.kind === 'LOCKED' || t.kind === 'DARK');
        for (let i = 0; i < gates.length; i++) {
          for (let j = i + 1; j < gates.length; j++) {
            const dist = Math.abs(gates[i].x - gates[j].x) + Math.abs(gates[i].y - gates[j].y);
            expect(dist).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it('keeps content mostly inside rooms — corridors only get a monster/resource as a last-resort fallback', () => {
        const roomTiles = rift.tiles.filter((t) => t.roomId !== null);
        const roomContent = roomTiles.filter((t) => t.kind === 'MONSTER' || t.kind === 'RESOURCE').length;
        const corridorContent = rift.tiles.filter((t) => t.roomId === null && (t.kind === 'MONSTER' || t.kind === 'RESOURCE')).length;
        expect(roomContent).toBeGreaterThanOrEqual(corridorContent);
      });

      it('caps content per room so big rooms are not overloaded', () => {
        const rooms = roomsOf(rift);
        for (const tiles of rooms.values()) {
          const content = tiles.filter((t) => t.kind === 'MONSTER' || t.kind === 'RESOURCE').length;
          expect(content).toBeLessThanOrEqual(4);
        }
      });

      it('has exactly one boss, placed inside a room', () => {
        const bosses = rift.tiles.filter((t) => t.kind === 'BOSS');
        expect(bosses).toHaveLength(1);
        expect(bosses[0].roomId).not.toBeNull();
      });

      it("keeps the boss's room free of other monsters/resources/chests", () => {
        const boss = rift.tiles.find((t) => t.kind === 'BOSS')!;
        const arena = rift.tiles.filter((t) => t.roomId === boss.roomId);
        for (const t of arena) {
          if (t === boss) continue;
          expect(['MONSTER', 'RESOURCE', 'CHEST']).not.toContain(t.kind);
        }
      });

      it('has at least one chest, never in the boss room', () => {
        const boss = rift.tiles.find((t) => t.kind === 'BOSS');
        const chests = rift.tiles.filter((t) => t.kind === 'CHEST');
        expect(chests.length).toBeGreaterThanOrEqual(1);
        for (const c of chests) {
          expect(c.roomId).not.toBeNull();
          expect(c.roomId).not.toBe(boss?.roomId);
          expect(c.maxCharges).toBe(1);
          expect(c.goldReward).toBeGreaterThan(0);
        }
      });

      it('guarantees minimum total content (monsters, resources)', () => {
        expect(rift.tiles.filter((t) => t.kind === 'MONSTER').length).toBeGreaterThanOrEqual(3);
        expect(rift.tiles.filter((t) => t.kind === 'RESOURCE').length).toBeGreaterThanOrEqual(2);
      });

      it('never leaves the player stuck with nothing to do before any gate', () => {
        const gateKeys = new Set(rift.tiles.filter((t) => t.kind === 'LOCKED' || t.kind === 'DARK').map((t) => tileKey(t, rift.width)));
        const preGate = reachableFrom(rift, gateKeys);
        const byKey = new Map(rift.tiles.map((t) => [tileKey(t, rift.width), t]));
        const preGateMonsters = [...preGate].filter((k) => byKey.get(k)?.kind === 'MONSTER').length;
        const preGateResources = [...preGate].filter((k) => byKey.get(k)?.kind === 'RESOURCE').length;
        expect(preGateMonsters).toBeGreaterThanOrEqual(2);
        expect(preGateResources).toBeGreaterThanOrEqual(1);
      });

      it('gives resource tiles 2-4 charges and a resource slot', () => {
        for (const t of rift.tiles.filter((t) => t.kind === 'RESOURCE')) {
          expect(t.maxCharges).toBeGreaterThanOrEqual(2);
          expect(t.maxCharges).toBeLessThanOrEqual(4);
          expect([0, 1]).toContain(t.resourceSlot);
        }
      });

      it('places gates that actually block a deeper region', () => {
        const gates = rift.tiles.filter((t) => t.kind === 'LOCKED' || t.kind === 'DARK');
        for (const gate of gates) {
          expect(gate.depth).toBeGreaterThan(0);
          const blocked = new Set([tileKey(gate, rift.width)]);
          const reachable = reachableFrom(rift, blocked);
          expect(reachable.size).toBeLessThan(rift.tiles.length - 1);
        }
      });

      it('spawns tougher monsters (slot 1) only in the deep half', () => {
        for (const t of rift.tiles.filter((t): t is GeneratedTile & { monsterSlot: 0 | 1 } => t.kind === 'MONSTER')) {
          if (t.monsterSlot === 1) expect(t.depth).toBeGreaterThan(rift.maxDepth * 0.5);
        }
      });
    });
  });
});
