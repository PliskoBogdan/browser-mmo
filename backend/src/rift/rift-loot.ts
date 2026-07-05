import type { RiftLootEntry } from '@my/shared';
import type { Prisma } from '../../prisma/generated/client/client';

// Staged rift-bag helpers shared by RiftService and BattleService (kept out of
// the services to avoid a circular import between the two modules).

export function parseRiftLoot(raw: Prisma.JsonValue | null | undefined): RiftLootEntry[] {
  return Array.isArray(raw) ? (raw as unknown as RiftLootEntry[]) : [];
}

export function addRiftLoot(current: RiftLootEntry[], additions: RiftLootEntry[]): RiftLootEntry[] {
  const result = current.map((e) => ({ ...e }));
  for (const add of additions) {
    const existing = result.find((e) => e.itemId === add.itemId);
    if (existing) existing.quantity += add.quantity;
    else result.push({ ...add });
  }
  return result;
}

// Death penalty: keep only `ratio` of every staged stack (rounded down).
export function applyDeathPenalty(loot: RiftLootEntry[], ratio: number): { kept: RiftLootEntry[]; lost: RiftLootEntry[] } {
  const kept: RiftLootEntry[] = [];
  const lost: RiftLootEntry[] = [];
  for (const entry of loot) {
    const keptQty = Math.floor(entry.quantity * ratio);
    if (keptQty > 0) kept.push({ ...entry, quantity: keptQty });
    if (entry.quantity - keptQty > 0) lost.push({ ...entry, quantity: entry.quantity - keptQty });
  }
  return { kept, lost };
}
