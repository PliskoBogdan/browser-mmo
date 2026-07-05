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

  console.log(`Monsters seeded: ${[feralHound, bandit, wolf, ghoul, bogTroll].map((m) => m.name).join(', ')}`);

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

  console.log(`Items seeded: ${[ironScraps, bentNails, tornCloth, banditTrinket, wolfPelt, ghoulIchor, trollFat].map((i) => i.name).join(', ')}`);

  // --- Monster loot tables ---
  const lootTable: { monsterId: number; itemId: number; dropChance: number; minQuantity: number; maxQuantity: number }[] = [
    { monsterId: feralHound.id, itemId: ironScraps.id, dropChance: 70, minQuantity: 1, maxQuantity: 2 },
    { monsterId: bandit.id, itemId: tornCloth.id, dropChance: 60, minQuantity: 1, maxQuantity: 2 },
    { monsterId: bandit.id, itemId: banditTrinket.id, dropChance: 15, minQuantity: 1, maxQuantity: 1 },
    { monsterId: wolf.id, itemId: wolfPelt.id, dropChance: 50, minQuantity: 1, maxQuantity: 1 },
    { monsterId: ghoul.id, itemId: ghoulIchor.id, dropChance: 40, minQuantity: 1, maxQuantity: 1 },
    { monsterId: ghoul.id, itemId: bentNails.id, dropChance: 60, minQuantity: 1, maxQuantity: 3 },
    { monsterId: bogTroll.id, itemId: trollFat.id, dropChance: 35, minQuantity: 1, maxQuantity: 1 },
    { monsterId: bogTroll.id, itemId: ironScraps.id, dropChance: 80, minQuantity: 2, maxQuantity: 4 },
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

  console.log(
    `Sub-locations seeded: ${[
      hamletGate,
      tradingPost,
      outskirts,
      villageSquare,
      forestEdge,
      woodlandTradingPost,
      deepForest,
      forestRuins,
      pilgrimsRest,
      moorTradingPost,
      blightedMarsh,
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
