// Tunables for rift generation, rewards and shared-world respawns.
// Item/monster references are by name and resolved against the DB when a rift
// is created (see RiftService.createRift) — keep these in sync with seed.ts.

export const ACTIVE_RIFT_LIFETIME_MS = 2 * 60 * 60 * 1000; // rift rotates out after 2h
export const MONSTER_RESPAWN_MS = 3 * 60 * 1000;
export const RESOURCE_RESPAWN_MS = 5 * 60 * 1000;
// Bosses shouldn't feel farmable — much longer than a regular monster.
export const BOSS_RESPAWN_MS = 20 * 60 * 1000;

// Extraction risk: on death you keep ceil(quantity * KEEP) of each staged stack.
export const DEATH_LOOT_KEEP_RATIO = 0.5;

// Exploration exp per newly revealed tile: (base + depth) * tier.
export const EXPLORE_EXP_BASE = 2;

// Gate items (consumed per player when stepping onto the gate tile).
export const TORCH_ITEM_NAME = 'Torch';
export const RIFT_KEY_ITEM_NAME = 'Rusty Key';

// Extra drops rolled on top of the monster's normal loot table, but only for
// battles fought inside a rift — this is where torches and keys come from.
export const RIFT_BONUS_DROPS: { itemName: string; chance: number; minQuantity: number; maxQuantity: number }[] = [
  { itemName: TORCH_ITEM_NAME, chance: 30, minQuantity: 1, maxQuantity: 1 },
  { itemName: RIFT_KEY_ITEM_NAME, chance: 15, minQuantity: 1, maxQuantity: 1 },
];

// Deeper rooms drop fatter loot: flat % added to every dropChance per depth step.
export const RIFT_LOOT_CHANCE_PER_DEPTH = 3;
export const RIFT_LOOT_CHANCE_CAP = 95;

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
