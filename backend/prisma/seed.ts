import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client/client';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Equipment (weapons + armor) ---
  const equipment: {
    name: string;
    slot: 'WEAPON' | 'HELMET' | 'BODY' | 'PANTS' | 'GLOVES';
    rarity?: 'COMMON' | 'UNCOMMON' | 'RARE';
    description?: string;
    sellValue?: number;
    price?: number;
    minLevel?: number;
    icon?: string;
    baseDamage?: number;
    attackSpeed?: number;
    strength?: number;
    agility?: number;
    accuracy?: number;
    endurance?: number;
    criticalDamage?: number;
    defense?: number;
  }[] = [
    // --- Tier 1 weapons (Lv1, Ruined Hamlet / Trading Post) ---
    { name: 'Rusty Sword', slot: 'WEAPON', description: 'A worn blade, nicked but still sharp enough.', baseDamage: 15, attackSpeed: 1.3, sellValue: 8, price: 30, minLevel: 1, icon: 'mdi-sword' },
    { name: 'Hand Axe', slot: 'WEAPON', description: 'A simple woodcutter’s axe, pressed into combat.', baseDamage: 20, attackSpeed: 1.0, strength: 2, sellValue: 12, price: 45, minLevel: 1, icon: 'mdi-axe' },
    { name: 'Training Rapier', slot: 'WEAPON', description: 'Light and quick, favoring precision over power.', baseDamage: 10, attackSpeed: 1.9, accuracy: 3, sellValue: 10, price: 35, minLevel: 1, icon: 'mdi-sword-cross' },

    // --- Tier 2 weapons (Lv5, Dark Forest / Woodland Trading Post) ---
    { name: 'Steel Sword', slot: 'WEAPON', rarity: 'UNCOMMON', description: 'A well-forged blade with real heft.', baseDamage: 30, attackSpeed: 1.3, strength: 2, sellValue: 25, price: 120, minLevel: 5, icon: 'mdi-sword' },
    { name: 'War Axe', slot: 'WEAPON', rarity: 'UNCOMMON', description: 'Heavy enough to cleave through armor.', baseDamage: 40, attackSpeed: 0.8, strength: 5, criticalDamage: 10, sellValue: 35, price: 160, minLevel: 5, icon: 'mdi-axe' },
    { name: "Duelist's Rapier", slot: 'WEAPON', rarity: 'UNCOMMON', description: 'Balanced steel favored by traveling swordmasters.', baseDamage: 22, attackSpeed: 2.0, accuracy: 6, agility: 3, sellValue: 30, price: 140, minLevel: 5, icon: 'mdi-sword-cross' },

    // --- Tier 3 weapons (Lv10, Cursed Moor / Moor Trading Post) ---
    { name: "Knight's Longsword", slot: 'WEAPON', rarity: 'RARE', description: 'A knightly blade, etched with an old house sigil.', baseDamage: 50, attackSpeed: 1.2, strength: 6, defense: 4, sellValue: 60, price: 320, minLevel: 10, icon: 'mdi-sword' },
    { name: "Executioner's Axe", slot: 'WEAPON', rarity: 'RARE', description: 'A brutal two-handed axe built for a single, decisive blow.', baseDamage: 65, attackSpeed: 0.7, strength: 10, criticalDamage: 20, sellValue: 80, price: 400, minLevel: 10, icon: 'mdi-axe' },
    { name: 'Silver Rapier', slot: 'WEAPON', rarity: 'RARE', description: 'Silver-inlaid steel, deadly against man and monster alike.', baseDamage: 38, attackSpeed: 2.2, accuracy: 10, agility: 5, criticalDamage: 15, sellValue: 70, price: 380, minLevel: 10, icon: 'mdi-sword-cross' },

    // --- Starter armor set (names must match STARTING_ARMOR_NAMES in auth.service) ---
    { name: 'Leather Cap', slot: 'HELMET', description: 'A dented but serviceable cap.', defense: 4, accuracy: 2, sellValue: 8, price: 20, minLevel: 1 },
    { name: 'Leather Jerkin', slot: 'BODY', description: 'A simple protective jerkin.', defense: 10, strength: 5, agility: -1, sellValue: 12, price: 28, minLevel: 1 },
    { name: 'Leather Trousers', slot: 'PANTS', description: 'Padded, flexible trousers.', agility: 4, endurance: 2, defense: 2, sellValue: 8, price: 20, minLevel: 1 },
    { name: 'Worn Leather Gloves', slot: 'GLOVES', description: 'Grip-enhancing leather gloves.', accuracy: 4, criticalDamage: 5, sellValue: 8, price: 20, minLevel: 1 },

    // --- Rarer armor to chase ---
    { name: 'Steel Helm', slot: 'HELMET', rarity: 'UNCOMMON', description: 'Heavy plating for the head.', defense: 12, endurance: 3, agility: -2, sellValue: 40, price: 90, minLevel: 5 },
    { name: 'Plate Armor', slot: 'BODY', rarity: 'RARE', description: 'Full plate, forged for knights.', defense: 25, strength: 8, agility: -3, sellValue: 90, price: 250, minLevel: 10 },

    // --- Craft-only gear (price 0, never listed in any shop — see forge
    // recipes below). Each piece is a sidegrade/upgrade you earn by hunting
    // the specific materials out in the world, not by saving gold.
    { name: 'Scrapiron Blade', slot: 'WEAPON', rarity: 'UNCOMMON', description: 'Hammered together from salvage. Uglier than any shop blade — and meaner.', baseDamage: 26, attackSpeed: 1.2, strength: 3, sellValue: 20, price: 0, minLevel: 3, icon: 'mdi-sword' },
    { name: 'Wolfhide Vest', slot: 'BODY', rarity: 'UNCOMMON', description: 'Layered wolf pelts, supple where plate would bind.', defense: 14, agility: 3, endurance: 2, sellValue: 35, price: 0, minLevel: 6 },
    { name: 'Ironbound Gauntlets', slot: 'GLOVES', rarity: 'UNCOMMON', description: 'Leather gloves ribbed with cold-hammered ore.', defense: 6, strength: 4, accuracy: 2, sellValue: 30, price: 0, minLevel: 7 },
    { name: 'Ghoulhide Leggings', slot: 'PANTS', rarity: 'RARE', description: 'Cured in ghoul ichor. Smells faintly wrong, moves exactly right.', agility: 6, defense: 8, endurance: 3, sellValue: 55, price: 0, minLevel: 9 },
    { name: 'Riftglass Longsword', slot: 'WEAPON', rarity: 'RARE', description: 'A blade edged with crystallized rift energy. It hums when drawn.', baseDamage: 44, attackSpeed: 1.4, accuracy: 5, criticalDamage: 10, sellValue: 85, price: 0, minLevel: 8, icon: 'mdi-sword' },
    { name: 'Fangblade of the Alpha', slot: 'WEAPON', rarity: 'RARE', description: "Forged around the Alpha's fang. It still wants to hunt.", baseDamage: 58, attackSpeed: 1.5, agility: 6, criticalDamage: 25, sellValue: 140, price: 0, minLevel: 10, icon: 'mdi-sword-cross' },
    { name: "Warlord's Warhelm", slot: 'HELMET', rarity: 'RARE', description: "The Warlord's emblem, reforged into a helm that remembers every battle.", defense: 16, strength: 5, endurance: 4, sellValue: 120, price: 0, minLevel: 11 },
    { name: 'Totemic Bulwark', slot: 'BODY', rarity: 'RARE', description: "Plate armor bound around the Chieftain's totem. Dark magic holds the seams.", defense: 30, endurance: 8, strength: 6, agility: -2, sellValue: 200, price: 0, minLevel: 12 },
  ];

  for (const e of equipment) {
    await prisma.equipmentItem.upsert({ where: { name: e.name }, update: e, create: e });
  }

  console.log(`Equipment seeded: ${equipment.map((e) => e.name).join(', ')}`);

  // --- Monsters ---
  const feralHound = await prisma.monster.upsert({
    where: { id: 1 },
    update: { name: 'Feral Hound', attackSpeed: 0.4, defense: 0, aiProfile: 'feral' },
    create: {
      name: 'Feral Hound',
      aiProfile: 'feral',
      maxHp: 30,
      damage: 5,
      defense: 0,
      attackSpeed: 0.4,
      expReward: 10,
      goldReward: 5,
    },
  });

  const bandit = await prisma.monster.upsert({
    where: { id: 2 },
    update: { attackSpeed: 0.5, defense: 5, aiProfile: 'cunning' },
    create: {
      name: 'Bandit',
      aiProfile: 'cunning',
      maxHp: 60,
      damage: 12,
      defense: 5,
      attackSpeed: 0.5,
      expReward: 25,
      goldReward: 15,
    },
  });

  const wolf = await prisma.monster.upsert({
    where: { id: 3 },
    update: { attackSpeed: 0.9, defense: 8, aiProfile: 'feral' },
    create: {
      name: 'Wolf',
      aiProfile: 'feral',
      maxHp: 80,
      damage: 18,
      defense: 8,
      attackSpeed: 0.9,
      expReward: 40,
      goldReward: 20,
    },
  });

  const ghoul = await prisma.monster.upsert({
    where: { id: 4 },
    update: { attackSpeed: 0.6, defense: 15, aiProfile: 'venomous' },
    create: {
      name: 'Ghoul',
      aiProfile: 'venomous',
      maxHp: 120,
      damage: 25,
      defense: 15,
      attackSpeed: 0.6,
      expReward: 70,
      goldReward: 35,
    },
  });

  const bogTroll = await prisma.monster.upsert({
    where: { id: 5 },
    update: { name: 'Bog Troll', attackSpeed: 0.5, defense: 25, aiProfile: 'venomous' },
    create: {
      name: 'Bog Troll',
      aiProfile: 'venomous',
      maxHp: 200,
      damage: 40,
      defense: 25,
      attackSpeed: 0.5,
      expReward: 120,
      goldReward: 60,
    },
  });

  // --- Rift bosses (one per tier, seeded with a much heavier statline) ---
  const alphaFeralHound = await prisma.monster.upsert({
    where: { id: 6 },
    update: { attackSpeed: 0.6, defense: 10, aiProfile: 'boss' },
    create: {
      name: 'Alpha Feral Hound',
      aiProfile: 'boss',
      maxHp: 250,
      damage: 22,
      defense: 10,
      attackSpeed: 0.6,
      expReward: 150,
      goldReward: 80,
    },
  });

  const direWolfWarlord = await prisma.monster.upsert({
    where: { id: 7 },
    update: { attackSpeed: 0.7, defense: 20, aiProfile: 'boss' },
    create: {
      name: 'Dire Wolf Warlord',
      aiProfile: 'boss',
      maxHp: 500,
      damage: 40,
      defense: 20,
      attackSpeed: 0.7,
      expReward: 350,
      goldReward: 180,
    },
  });

  const bogTrollChieftain = await prisma.monster.upsert({
    where: { id: 8 },
    update: { attackSpeed: 0.5, defense: 35, aiProfile: 'boss' },
    create: {
      name: 'Bog Troll Chieftain',
      aiProfile: 'boss',
      maxHp: 900,
      damage: 65,
      defense: 35,
      attackSpeed: 0.5,
      expReward: 700,
      goldReward: 400,
    },
  });

  console.log(`Monsters seeded: ${[feralHound, bandit, wolf, ghoul, bogTroll, alphaFeralHound, direWolfWarlord, bogTrollChieftain].map((m) => m.name).join(', ')}`);

  // --- Items ---
  const ironScraps = await prisma.item.upsert({
    where: { name: 'Rusty Iron Scraps' },
    update: {},
    create: { name: 'Rusty Iron Scraps', description: 'Rusted fragments of old ironwork.', sellValue: 3, rarity: 'COMMON' },
  });
  const bentNails = await prisma.item.upsert({
    where: { name: 'Bent Nails' },
    update: {},
    create: { name: 'Bent Nails', description: 'A handful of corroded nails.', sellValue: 4, rarity: 'COMMON' },
  });
  const tornCloth = await prisma.item.upsert({
    where: { name: 'Torn Cloth' },
    update: {},
    create: { name: 'Torn Cloth', description: "Ragged fabric stripped from a bandit's coat.", sellValue: 5, rarity: 'COMMON' },
  });
  const banditTrinket = await prisma.item.upsert({
    where: { name: "Bandit's Trinket" },
    update: {},
    create: { name: "Bandit's Trinket", description: "A cheap charm a bandit carried for luck. Didn't work.", sellValue: 20, rarity: 'UNCOMMON' },
  });
  const wolfPelt = await prisma.item.upsert({
    where: { name: 'Wolf Pelt' },
    update: {},
    create: { name: 'Wolf Pelt', description: 'A thick, matted pelt. Traders pay well for these.', sellValue: 15, rarity: 'UNCOMMON' },
  });
  const ghoulIchor = await prisma.item.upsert({
    where: { name: 'Ghoul Ichor' },
    update: {},
    create: { name: 'Ghoul Ichor', description: 'A vial of viscous, faintly glowing fluid.', sellValue: 30, rarity: 'UNCOMMON' },
  });
  const trollFat = await prisma.item.upsert({
    where: { name: 'Troll Fat' },
    update: {},
    create: { name: 'Troll Fat', description: 'A pulsing lump of fat still warm to the touch. Valuable to the right buyer.', sellValue: 75, rarity: 'RARE' },
  });

  // --- Food (staminaRestore != null → edible via POST /inventory/:id/use) ---
  const wolfMeatData = { name: 'Wolf Meat', description: 'A raw cut of wolf. Edible in a pinch, better in a stew.', sellValue: 6, rarity: 'COMMON' as const, staminaRestore: 10 };
  const wolfMeat = await prisma.item.upsert({ where: { name: 'Wolf Meat' }, update: wolfMeatData, create: wolfMeatData });
  const trailRationsData = { name: 'Trail Rations', description: 'Hardtack and dried fruit. Keeps a traveler on their feet.', sellValue: 4, rarity: 'COMMON' as const, buyPrice: 12, staminaRestore: 25 };
  const trailRations = await prisma.item.upsert({ where: { name: 'Trail Rations' }, update: trailRationsData, create: trailRationsData });
  const travelersStewData = { name: "Traveler's Stew", description: 'Emberleaf and wolf meat, simmered thick. Warms you to the bones.', sellValue: 15, rarity: 'UNCOMMON' as const, staminaRestore: 60 };
  const travelersStew = await prisma.item.upsert({ where: { name: "Traveler's Stew" }, update: travelersStewData, create: travelersStewData });

  console.log(`Items seeded: ${[ironScraps, bentNails, tornCloth, banditTrinket, wolfPelt, ghoulIchor, trollFat, wolfMeat, trailRations, travelersStew].map((i) => i.name).join(', ')}`);

  // --- Rift items ---
  // Gate openers (consumed when stepping onto LOCKED/DARK rift tiles) — names
  // must match TORCH_ITEM_NAME / RIFT_KEY_ITEM_NAME in src/rift/rift.config.ts.
  // Torch drops from rift mobs AND can be bought (buyPrice set, see shop
  // listing below); Rusty Key is drop-only (buyPrice left unset).
  const riftItems: { name: string; description: string; sellValue: number; rarity: 'COMMON' | 'UNCOMMON' | 'RARE'; buyPrice?: number }[] = [
    { name: 'Torch', description: 'A pitch-soaked torch. Lights the way into dark caves — burns out after one use.', sellValue: 2, rarity: 'COMMON', buyPrice: 15 },
    { name: 'Rusty Key', description: 'A corroded key looted inside a rift. Opens one sealed door.', sellValue: 10, rarity: 'UNCOMMON' },
    // Gatherable resources (RESOURCE tiles; shared, depleting nodes) — also
    // what chests award (the tier's [1] entry).
    { name: 'Emberleaf Herb', description: 'A warm-to-the-touch herb that only grows near rift energy.', sellValue: 6, rarity: 'COMMON' },
    { name: 'Iron Ore Chunk', description: 'A heavy chunk of ore, veined with something that glimmers.', sellValue: 14, rarity: 'UNCOMMON' },
    { name: 'Riftglass Shard', description: 'A shard of crystallized rift energy. Hums faintly.', sellValue: 35, rarity: 'UNCOMMON' },
    { name: 'Ancient Relic', description: 'An artifact from whatever world the rift tore open. Collectors pay dearly.', sellValue: 120, rarity: 'RARE' },
    // Boss trophies — guaranteed drop, sold nowhere, worth a lot to a buyer.
    { name: "Alpha's Fang", description: "A curved fang torn from the Alpha Feral Hound. Still warm.", sellValue: 90, rarity: 'RARE' },
    { name: "Warlord's Emblem", description: 'A bloodied emblem the Dire Wolf Warlord wore into every fight.', sellValue: 220, rarity: 'RARE' },
    { name: "Chieftain's Totem", description: "The Bog Troll Chieftain's totem, still humming with dark magic.", sellValue: 500, rarity: 'RARE' },
  ];

  const riftItemByName = new Map<string, Awaited<ReturnType<typeof prisma.item.upsert>>>();
  for (const item of riftItems) {
    riftItemByName.set(item.name, await prisma.item.upsert({ where: { name: item.name }, update: item, create: item }));
  }
  const alphaFang = riftItemByName.get("Alpha's Fang")!;
  const warlordEmblem = riftItemByName.get("Warlord's Emblem")!;
  const chieftainTotem = riftItemByName.get("Chieftain's Totem")!;

  console.log(`Rift items seeded: ${riftItems.map((i) => i.name).join(', ')}`);

  // --- Monster loot tables ---
  const lootTable: { monsterId: number; itemId: number; dropChance: number; minQuantity: number; maxQuantity: number }[] = [
    { monsterId: feralHound.id, itemId: ironScraps.id, dropChance: 70, minQuantity: 1, maxQuantity: 2 },
    { monsterId: bandit.id, itemId: tornCloth.id, dropChance: 60, minQuantity: 1, maxQuantity: 2 },
    { monsterId: bandit.id, itemId: banditTrinket.id, dropChance: 15, minQuantity: 1, maxQuantity: 1 },
    { monsterId: wolf.id, itemId: wolfPelt.id, dropChance: 50, minQuantity: 1, maxQuantity: 1 },
    { monsterId: wolf.id, itemId: wolfMeat.id, dropChance: 60, minQuantity: 1, maxQuantity: 2 },
    { monsterId: ghoul.id, itemId: ghoulIchor.id, dropChance: 40, minQuantity: 1, maxQuantity: 1 },
    { monsterId: ghoul.id, itemId: bentNails.id, dropChance: 60, minQuantity: 1, maxQuantity: 3 },
    { monsterId: bogTroll.id, itemId: trollFat.id, dropChance: 35, minQuantity: 1, maxQuantity: 1 },
    { monsterId: bogTroll.id, itemId: ironScraps.id, dropChance: 80, minQuantity: 2, maxQuantity: 4 },
    // Boss trophies — always drop, that's the whole point of fighting one.
    { monsterId: alphaFeralHound.id, itemId: alphaFang.id, dropChance: 100, minQuantity: 1, maxQuantity: 1 },
    { monsterId: direWolfWarlord.id, itemId: warlordEmblem.id, dropChance: 100, minQuantity: 1, maxQuantity: 1 },
    { monsterId: bogTrollChieftain.id, itemId: chieftainTotem.id, dropChance: 100, minQuantity: 1, maxQuantity: 1 },
  ];

  for (const entry of lootTable) {
    await prisma.monsterLoot.upsert({
      where: { monsterId_itemId: { monsterId: entry.monsterId, itemId: entry.itemId } },
      update: entry,
      create: entry,
    });
  }

  console.log('Monster loot tables seeded.');

  // --- Locations ---
  const ruinedHamletData = {
    id: 1,
    name: 'Ruined Hamlet',
    description: 'A fallen village overrun by bandits and feral hounds.',
    minLevel: 1,
    mapX: 1,
    mapY: 2,
    gridWidth: 3,
    gridHeight: 3,
  };
  const ruinedHamlet = await prisma.location.upsert({
    where: { id: 1 },
    update: ruinedHamletData,
    create: ruinedHamletData,
  });

  const darkForestData = {
    id: 2,
    name: 'Dark Forest',
    description: 'An ancient forest where unnatural creatures roam at night.',
    minLevel: 5,
    mapX: 3,
    mapY: 1,
    gridWidth: 3,
    gridHeight: 3,
  };
  const darkForest = await prisma.location.upsert({
    where: { id: 2 },
    update: darkForestData,
    create: darkForestData,
  });

  const cursedMoorData = {
    id: 3,
    name: 'Cursed Moor',
    description: 'A blighted moor twisted by dark magic, home to corrupted beasts.',
    minLevel: 10,
    mapX: 5,
    mapY: 3,
    gridWidth: 3,
    gridHeight: 2,
  };
  const cursedMoor = await prisma.location.upsert({
    where: { id: 3 },
    update: cursedMoorData,
    create: cursedMoorData,
  });

  console.log(`Locations seeded: ${[ruinedHamlet, darkForest, cursedMoor].map((l) => l.name).join(', ')}`);

  // --- Sub-Locations: Ruined Hamlet (3x3 grid) ---
  const hamletGateData = {
    id: 1,
    locationId: ruinedHamlet.id,
    name: 'Hamlet Gate',
    description: 'The entrance to the ruined hamlet. Relatively safe.',
    kind: 'SAFE' as const,
    minLevel: 1,
    gridX: 1,
    gridY: 0,
  };
  const hamletGate = await prisma.subLocation.upsert({ where: { id: 1 }, update: hamletGateData, create: hamletGateData });

  const tradingPostData = {
    id: 9,
    locationId: ruinedHamlet.id,
    name: 'Trading Post',
    description: 'A makeshift merchant stall selling salvaged gear.',
    kind: 'SHOP' as const,
    minLevel: 1,
    gridX: 2,
    gridY: 0,
  };
  const tradingPost = await prisma.subLocation.upsert({ where: { id: 9 }, update: tradingPostData, create: tradingPostData });

  const outskirtsData = {
    id: 2,
    locationId: ruinedHamlet.id,
    name: 'Outskirts',
    description: 'The outskirts are prowled by feral hounds.',
    kind: 'DANGER' as const,
    minLevel: 1,
    gridX: 0,
    gridY: 2,
  };
  const outskirts = await prisma.subLocation.upsert({ where: { id: 2 }, update: outskirtsData, create: outskirtsData });

  const villageSquareData = {
    id: 3,
    locationId: ruinedHamlet.id,
    name: 'Village Square',
    description: 'Bandits have made this their home.',
    kind: 'DANGER' as const,
    minLevel: 3,
    gridX: 2,
    gridY: 2,
  };
  const villageSquare = await prisma.subLocation.upsert({ where: { id: 3 }, update: villageSquareData, create: villageSquareData });

  // Loot buyer — deliberately a different tile from the Trading Post so
  // buying gear and selling loot cost separate trips (relevant once stamina
  // is spent per tile moved).
  const pawnbrokerData = {
    id: 12,
    locationId: ruinedHamlet.id,
    name: 'Pawnbroker',
    description: 'A hunched trader who pays coin for salvage and curiosities.',
    kind: 'LOOT_SHOP' as const,
    minLevel: 1,
    gridX: 1,
    gridY: 2,
  };
  const pawnbroker = await prisma.subLocation.upsert({ where: { id: 12 }, update: pawnbrokerData, create: pawnbrokerData });

  // --- Sub-Locations: Dark Forest (3x3 grid) ---
  const forestEdgeData = {
    id: 4,
    locationId: darkForest.id,
    name: 'Forest Edge',
    description: 'The edge of the forest. Safe to rest here.',
    kind: 'SAFE' as const,
    minLevel: 5,
    gridX: 1,
    gridY: 0,
  };
  const forestEdge = await prisma.subLocation.upsert({ where: { id: 4 }, update: forestEdgeData, create: forestEdgeData });

  const woodlandTradingPostData = {
    id: 10,
    locationId: darkForest.id,
    name: 'Woodland Trading Post',
    description: 'A traveling smith who trades in steel and salvage.',
    kind: 'SHOP' as const,
    minLevel: 5,
    gridX: 1,
    gridY: 1,
  };
  const woodlandTradingPost = await prisma.subLocation.upsert({ where: { id: 10 }, update: woodlandTradingPostData, create: woodlandTradingPostData });

  const deepForestData = {
    id: 5,
    locationId: darkForest.id,
    name: 'Deep Forest',
    description: 'Wolves hunt in packs here.',
    kind: 'DANGER' as const,
    minLevel: 5,
    gridX: 0,
    gridY: 2,
  };
  const deepForest = await prisma.subLocation.upsert({ where: { id: 5 }, update: deepForestData, create: deepForestData });

  const forestRuinsData = {
    id: 6,
    locationId: darkForest.id,
    name: 'Forest Ruins',
    description: 'Ancient ruins crawling with ghouls.',
    kind: 'DANGER' as const,
    minLevel: 8,
    gridX: 2,
    gridY: 2,
  };
  const forestRuins = await prisma.subLocation.upsert({ where: { id: 6 }, update: forestRuinsData, create: forestRuinsData });

  const woodlandPawnbrokerData = {
    id: 13,
    locationId: darkForest.id,
    name: 'Woodland Pawnbroker',
    description: 'A reclusive peddler who trades coin for whatever the woods leave behind.',
    kind: 'LOOT_SHOP' as const,
    minLevel: 5,
    gridX: 2,
    gridY: 0,
  };
  const woodlandPawnbroker = await prisma.subLocation.upsert({ where: { id: 13 }, update: woodlandPawnbrokerData, create: woodlandPawnbrokerData });

  // --- Sub-Locations: Cursed Moor (3x2 grid) ---
  const pilgrimsRestData = {
    id: 7,
    locationId: cursedMoor.id,
    name: "Pilgrim's Rest",
    description: 'A small camp of pilgrims. Safe to rest.',
    kind: 'SAFE' as const,
    minLevel: 10,
    gridX: 1,
    gridY: 0,
  };
  const pilgrimsRest = await prisma.subLocation.upsert({ where: { id: 7 }, update: pilgrimsRestData, create: pilgrimsRestData });

  const moorTradingPostData = {
    id: 11,
    locationId: cursedMoor.id,
    name: 'Moor Trading Post',
    description: 'A grim trader who deals in relics of fallen knights.',
    kind: 'SHOP' as const,
    minLevel: 10,
    gridX: 2,
    gridY: 0,
  };
  const moorTradingPost = await prisma.subLocation.upsert({ where: { id: 11 }, update: moorTradingPostData, create: moorTradingPostData });

  const blightedMarshData = {
    id: 8,
    locationId: cursedMoor.id,
    name: 'Blighted Marsh',
    description: 'Corrupted beasts roam this cursed hellscape.',
    kind: 'DANGER' as const,
    minLevel: 10,
    gridX: 1,
    gridY: 1,
  };
  const blightedMarsh = await prisma.subLocation.upsert({ where: { id: 8 }, update: blightedMarshData, create: blightedMarshData });

  const moorPawnbrokerData = {
    id: 14,
    locationId: cursedMoor.id,
    name: 'Moor Pawnbroker',
    description: 'A wary trader who pays coin for whatever you dragged out of the marsh.',
    kind: 'LOOT_SHOP' as const,
    minLevel: 10,
    gridX: 0,
    gridY: 1,
  };
  const moorPawnbroker = await prisma.subLocation.upsert({ where: { id: 14 }, update: moorPawnbrokerData, create: moorPawnbrokerData });

  // --- Forges (crafting stations) — one per location, tiered like the shops.
  const hamletForgeData = {
    id: 15,
    locationId: ruinedHamlet.id,
    name: 'Hamlet Forge',
    description: 'A soot-stained smithy. The old smith works salvage into serviceable steel.',
    kind: 'FORGE' as const,
    minLevel: 1,
    gridX: 0,
    gridY: 0,
  };
  const hamletForge = await prisma.subLocation.upsert({ where: { id: 15 }, update: hamletForgeData, create: hamletForgeData });

  const woodlandForgeData = {
    id: 16,
    locationId: darkForest.id,
    name: 'Woodland Forge',
    description: 'A charcoal-burner turned smith, working pelts and ore by firelight.',
    kind: 'FORGE' as const,
    minLevel: 5,
    gridX: 0,
    gridY: 0,
  };
  const woodlandForge = await prisma.subLocation.upsert({ where: { id: 16 }, update: woodlandForgeData, create: woodlandForgeData });

  const moorlandForgeData = {
    id: 17,
    locationId: cursedMoor.id,
    name: 'Moorland Forge',
    description: 'A ruined chapel repurposed as a forge. The smith asks no questions about trophies.',
    kind: 'FORGE' as const,
    minLevel: 10,
    gridX: 0,
    gridY: 0,
  };
  const moorlandForge = await prisma.subLocation.upsert({ where: { id: 17 }, update: moorlandForgeData, create: moorlandForgeData });

  console.log(
    `Sub-locations seeded: ${[
      hamletGate,
      tradingPost,
      outskirts,
      villageSquare,
      pawnbroker,
      forestEdge,
      woodlandTradingPost,
      deepForest,
      forestRuins,
      woodlandPawnbroker,
      pilgrimsRest,
      moorTradingPost,
      blightedMarsh,
      moorPawnbroker,
      hamletForge,
      woodlandForge,
      moorlandForge,
    ]
      .map((s) => s.name)
      .join(', ')}`,
  );

  // Explicit ids were used above so upserts stay stable across reseeds; keep the
  // autoincrement sequences ahead of them so future inserts don't collide.
  await prisma.$executeRawUnsafe(`SELECT setval('"Location_id_seq"', (SELECT MAX(id) FROM "Location"))`);
  await prisma.$executeRawUnsafe(`SELECT setval('"SubLocation_id_seq"', (SELECT MAX(id) FROM "SubLocation"))`);

  // --- Shop listings ---
  const shopStock: { subLocationId: number; equipmentName: string }[] = [
    // Trading Post (Ruined Hamlet, Lv1): tier-1 weapons + starter armor.
    { subLocationId: tradingPost.id, equipmentName: 'Rusty Sword' },
    { subLocationId: tradingPost.id, equipmentName: 'Hand Axe' },
    { subLocationId: tradingPost.id, equipmentName: 'Training Rapier' },
    { subLocationId: tradingPost.id, equipmentName: 'Leather Cap' },
    { subLocationId: tradingPost.id, equipmentName: 'Leather Jerkin' },
    { subLocationId: tradingPost.id, equipmentName: 'Leather Trousers' },
    { subLocationId: tradingPost.id, equipmentName: 'Worn Leather Gloves' },
    // Woodland Trading Post (Dark Forest, Lv5): tier-2 weapons + Steel Helm.
    { subLocationId: woodlandTradingPost.id, equipmentName: 'Steel Sword' },
    { subLocationId: woodlandTradingPost.id, equipmentName: 'War Axe' },
    { subLocationId: woodlandTradingPost.id, equipmentName: "Duelist's Rapier" },
    { subLocationId: woodlandTradingPost.id, equipmentName: 'Steel Helm' },
    // Moor Trading Post (Cursed Moor, Lv10): tier-3 weapons + Plate Armor.
    { subLocationId: moorTradingPost.id, equipmentName: "Knight's Longsword" },
    { subLocationId: moorTradingPost.id, equipmentName: "Executioner's Axe" },
    { subLocationId: moorTradingPost.id, equipmentName: 'Silver Rapier' },
    { subLocationId: moorTradingPost.id, equipmentName: 'Plate Armor' },
  ];

  const equipmentByName = new Map((await prisma.equipmentItem.findMany()).map((e) => [e.name, e]));
  for (const entry of shopStock) {
    const item = equipmentByName.get(entry.equipmentName);
    if (!item) throw new Error(`Unknown equipment in shop stock: ${entry.equipmentName}`);
    await prisma.shopListing.upsert({
      where: { subLocationId_equipmentItemId: { subLocationId: entry.subLocationId, equipmentItemId: item.id } },
      update: {},
      create: { subLocationId: entry.subLocationId, equipmentItemId: item.id },
    });
  }

  console.log('Shop listings seeded.');

  // --- Shop item listings (consumables) ---
  // Torch is purchasable at the starter Trading Post; Rusty Key stays
  // drop-only (no buyPrice, so it's never listed here).
  const torch = riftItemByName.get('Torch')!;
  await prisma.shopItemListing.upsert({
    where: { subLocationId_itemId: { subLocationId: tradingPost.id, itemId: torch.id } },
    update: {},
    create: { subLocationId: tradingPost.id, itemId: torch.id },
  });

  // Trail Rations are travel fuel — every trading post stocks them.
  for (const post of [tradingPost, woodlandTradingPost, moorTradingPost]) {
    await prisma.shopItemListing.upsert({
      where: { subLocationId_itemId: { subLocationId: post.id, itemId: trailRations.id } },
      update: {},
      create: { subLocationId: post.id, itemId: trailRations.id },
    });
  }

  console.log('Shop item listings seeded.');

  // --- Crafting recipes ---
  // Craft-only gear (price 0, no shop listing) plus a consumable bundle.
  // Ingredient names reference monster loot and rift resources seeded above,
  // result names reference the craft-only equipment block — both resolved by
  // name so reseeds stay stable.
  const recipes: {
    name: string;
    description: string;
    goldCost: number;
    minLevel: number;
    forgeId: number;
    resultEquipmentName?: string;
    resultItemName?: string;
    resultQuantity?: number;
    ingredients: { itemName: string; quantity: number }[];
  }[] = [
    // Hamlet Forge (Lv1): entry recipes from hamlet loot + rift herbs.
    {
      name: 'Bundle of Torches',
      description: 'Emberleaf burns slow and bright — three torches from one pressing.',
      goldCost: 5,
      minLevel: 1,
      forgeId: hamletForge.id,
      resultItemName: 'Torch',
      resultQuantity: 3,
      ingredients: [
        { itemName: 'Emberleaf Herb', quantity: 2 },
        { itemName: 'Torn Cloth', quantity: 1 },
      ],
    },
    {
      name: 'Scrapiron Blade',
      description: 'Every hound and ghoul in the hamlet carries a piece of this sword.',
      goldCost: 25,
      minLevel: 3,
      forgeId: hamletForge.id,
      resultEquipmentName: 'Scrapiron Blade',
      ingredients: [
        { itemName: 'Rusty Iron Scraps', quantity: 8 },
        { itemName: 'Torn Cloth', quantity: 2 },
      ],
    },
    // Woodland Forge (Lv5): pelts + rift ore, plus travel food from the hunt.
    {
      name: "Traveler's Stew",
      description: 'Two servings of thick stew — the smith cooks it over the forge coals.',
      goldCost: 10,
      minLevel: 5,
      forgeId: woodlandForge.id,
      resultItemName: "Traveler's Stew",
      resultQuantity: 2,
      ingredients: [
        { itemName: 'Emberleaf Herb', quantity: 2 },
        { itemName: 'Wolf Meat', quantity: 1 },
      ],
    },
    {
      name: 'Wolfhide Vest',
      description: 'Four pelts, cut and layered against the cold and worse.',
      goldCost: 60,
      minLevel: 6,
      forgeId: woodlandForge.id,
      resultEquipmentName: 'Wolfhide Vest',
      ingredients: [
        { itemName: 'Wolf Pelt', quantity: 4 },
        { itemName: 'Torn Cloth', quantity: 3 },
      ],
    },
    {
      name: 'Ironbound Gauntlets',
      description: 'Rift ore hammered flat over wolf leather.',
      goldCost: 80,
      minLevel: 7,
      forgeId: woodlandForge.id,
      resultEquipmentName: 'Ironbound Gauntlets',
      ingredients: [
        { itemName: 'Iron Ore Chunk', quantity: 4 },
        { itemName: 'Wolf Pelt', quantity: 2 },
      ],
    },
    {
      name: 'Riftglass Longsword',
      description: 'Riftglass holds an edge no whetstone can give.',
      goldCost: 150,
      minLevel: 8,
      forgeId: woodlandForge.id,
      resultEquipmentName: 'Riftglass Longsword',
      ingredients: [
        { itemName: 'Riftglass Shard', quantity: 3 },
        { itemName: 'Iron Ore Chunk', quantity: 5 },
      ],
    },
    // Moorland Forge (Lv10): boss trophies become endgame gear.
    {
      name: 'Ghoulhide Leggings',
      description: 'Ichor-cured hide, tanned the way only a moor smith knows.',
      goldCost: 120,
      minLevel: 9,
      forgeId: moorlandForge.id,
      resultEquipmentName: 'Ghoulhide Leggings',
      ingredients: [
        { itemName: 'Ghoul Ichor', quantity: 4 },
        { itemName: 'Wolf Pelt', quantity: 3 },
      ],
    },
    {
      name: 'Fangblade of the Alpha',
      description: "Bring the Alpha's fang and enough steel to build a blade around it.",
      goldCost: 250,
      minLevel: 10,
      forgeId: moorlandForge.id,
      resultEquipmentName: 'Fangblade of the Alpha',
      ingredients: [
        { itemName: "Alpha's Fang", quantity: 1 },
        { itemName: 'Riftglass Shard', quantity: 2 },
        { itemName: 'Iron Ore Chunk', quantity: 4 },
      ],
    },
    {
      name: "Warlord's Warhelm",
      description: "The Warlord's emblem, beaten into a helm over a bed of pelts.",
      goldCost: 300,
      minLevel: 11,
      forgeId: moorlandForge.id,
      resultEquipmentName: "Warlord's Warhelm",
      ingredients: [
        { itemName: "Warlord's Emblem", quantity: 1 },
        { itemName: 'Wolf Pelt', quantity: 4 },
        { itemName: 'Iron Ore Chunk', quantity: 3 },
      ],
    },
    {
      name: 'Totemic Bulwark',
      description: "The Chieftain's totem, sealed inside plate with troll fat and a relic's power.",
      goldCost: 500,
      minLevel: 12,
      forgeId: moorlandForge.id,
      resultEquipmentName: 'Totemic Bulwark',
      ingredients: [
        { itemName: "Chieftain's Totem", quantity: 1 },
        { itemName: 'Troll Fat', quantity: 3 },
        { itemName: 'Ancient Relic', quantity: 1 },
      ],
    },
  ];

  const equipmentByNameForCraft = new Map((await prisma.equipmentItem.findMany()).map((e) => [e.name, e]));
  const itemByName = new Map((await prisma.item.findMany()).map((i) => [i.name, i]));

  for (const r of recipes) {
    const resultEquipment = r.resultEquipmentName ? equipmentByNameForCraft.get(r.resultEquipmentName) : undefined;
    if (r.resultEquipmentName && !resultEquipment) throw new Error(`Unknown equipment in recipe result: ${r.resultEquipmentName}`);
    const resultItem = r.resultItemName ? itemByName.get(r.resultItemName) : undefined;
    if (r.resultItemName && !resultItem) throw new Error(`Unknown item in recipe result: ${r.resultItemName}`);

    const recipeData = {
      name: r.name,
      description: r.description,
      goldCost: r.goldCost,
      minLevel: r.minLevel,
      resultEquipmentId: resultEquipment?.id ?? null,
      resultItemId: resultItem?.id ?? null,
      resultQuantity: r.resultQuantity ?? 1,
    };
    const recipe = await prisma.craftingRecipe.upsert({ where: { name: r.name }, update: recipeData, create: recipeData });

    // Replace the ingredient list wholesale so reseeds pick up balance changes.
    await prisma.craftingIngredient.deleteMany({ where: { recipeId: recipe.id } });
    await prisma.craftingIngredient.createMany({
      data: r.ingredients.map((ing) => {
        const item = itemByName.get(ing.itemName);
        if (!item) throw new Error(`Unknown item in recipe ingredients: ${ing.itemName}`);
        return { recipeId: recipe.id, itemId: item.id, quantity: ing.quantity };
      }),
    });

    await prisma.forgeListing.upsert({
      where: { subLocationId_recipeId: { subLocationId: r.forgeId, recipeId: recipe.id } },
      update: {},
      create: { subLocationId: r.forgeId, recipeId: recipe.id },
    });
  }

  console.log(`Crafting recipes seeded: ${recipes.map((r) => r.name).join(', ')}`);

  // --- Monster Spawns ---
  // Outskirts: Feral Hounds (high weight) + Bandits (low weight)
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: outskirts.id, monsterId: feralHound.id } },
    update: {},
    create: { subLocationId: outskirts.id, monsterId: feralHound.id, spawnWeight: 80 },
  });
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: outskirts.id, monsterId: bandit.id } },
    update: {},
    create: { subLocationId: outskirts.id, monsterId: bandit.id, spawnWeight: 20 },
  });

  // Village Square: Bandits only
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: villageSquare.id, monsterId: bandit.id } },
    update: {},
    create: { subLocationId: villageSquare.id, monsterId: bandit.id, spawnWeight: 100 },
  });

  // Deep Forest: Wolves
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: deepForest.id, monsterId: wolf.id } },
    update: {},
    create: { subLocationId: deepForest.id, monsterId: wolf.id, spawnWeight: 100 },
  });

  // Forest Ruins: Ghouls (high) + Wolves (low)
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: forestRuins.id, monsterId: ghoul.id } },
    update: {},
    create: { subLocationId: forestRuins.id, monsterId: ghoul.id, spawnWeight: 70 },
  });
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: forestRuins.id, monsterId: wolf.id } },
    update: {},
    create: { subLocationId: forestRuins.id, monsterId: wolf.id, spawnWeight: 30 },
  });

  // Blighted Marsh: Bog Trolls
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: blightedMarsh.id, monsterId: bogTroll.id } },
    update: {},
    create: { subLocationId: blightedMarsh.id, monsterId: bogTroll.id, spawnWeight: 100 },
  });

  console.log('Monster spawns seeded.');
  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
