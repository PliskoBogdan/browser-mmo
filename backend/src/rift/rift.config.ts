// Rift *content* definitions: tier layouts, name pools, gate items and bonus
// drop tables. Scalar tunables (lifetime, respawns, loot chances, exploration
// exp, death penalty) live in GAME_CONFIG.rift / GAME_CONFIG.death.
// Item/monster references are by name and resolved against the DB when a rift
// is created (see RiftService.createRift) — keep these in sync with seed.ts.

// Gate items (consumed per player when stepping onto the gate tile).
export const TORCH_ITEM_NAME = 'Torch';
export const RIFT_KEY_ITEM_NAME = 'Rusty Key';

// Extra drops rolled on top of the monster's normal loot table, but only for
// battles fought inside a rift — this is where torches and keys come from.
export const RIFT_BONUS_DROPS: { itemName: string; chance: number; minQuantity: number; maxQuantity: number }[] = [
  { itemName: TORCH_ITEM_NAME, chance: 30, minQuantity: 1, maxQuantity: 1 },
  { itemName: RIFT_KEY_ITEM_NAME, chance: 15, minQuantity: 1, maxQuantity: 1 },
];

export interface RiftTierConfig {
  tier: number;
  minLevel: number;
  size: number; // square grid side
  namePool: string[];
  // monsterNames[0] spawns in the shallow half, [1] in the deep half.
  monsterNames: [string, string];
  // resourceNames[0] is the common node, [1] the rare deep node (top ~25% depth)
  // and also what chests award.
  resourceNames: [string, string];
  // The single boss monster for this tier — seeded with its own guaranteed
  // rare drop (see prisma/seed.ts).
  bossMonsterName: string;
}

export const RIFT_TIERS: RiftTierConfig[] = [
  {
    tier: 1,
    minLevel: 1,
    size: 10,
    namePool: ['Cracked Hollow', 'Whispering Fissure', 'Sunken Burrow'],
    monsterNames: ['Feral Hound', 'Bandit'],
    resourceNames: ['Emberleaf Herb', 'Iron Ore Chunk'],
    bossMonsterName: 'Alpha Feral Hound',
  },
  {
    tier: 2,
    minLevel: 5,
    size: 12,
    namePool: ['Umbral Breach', 'Howling Chasm', 'Verdant Rift'],
    monsterNames: ['Wolf', 'Ghoul'],
    resourceNames: ['Iron Ore Chunk', 'Riftglass Shard'],
    bossMonsterName: 'Dire Wolf Warlord',
  },
  {
    tier: 3,
    minLevel: 10,
    size: 14,
    namePool: ['Abyssal Tear', 'Screaming Maw', 'Voidtouched Scar'],
    monsterNames: ['Ghoul', 'Bog Troll'],
    resourceNames: ['Riftglass Shard', 'Ancient Relic'],
    bossMonsterName: 'Bog Troll Chieftain',
  },
];

export const RIFT_TIER_BY_TIER = new Map(RIFT_TIERS.map((t) => [t.tier, t]));
