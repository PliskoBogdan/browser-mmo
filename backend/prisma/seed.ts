import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client/client';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Weapons ---
  const pistol = await prisma.weapon.upsert({
    where: { name: 'Pistol' },
    update: { attackSpeed: 1.5 },
    create: { name: 'Pistol', damage: 15, attackSpeed: 1.5 },
  });

  const shotgun = await prisma.weapon.upsert({
    where: { name: 'Shotgun' },
    update: { attackSpeed: 0.6 },
    create: { name: 'Shotgun', damage: 35, attackSpeed: 0.6 },
  });

  const smg = await prisma.weapon.upsert({
    where: { name: 'SMG' },
    update: { attackSpeed: 2 },
    create: { name: 'SMG', damage: 10, attackSpeed: 2 },
  });

  console.log(`Weapons seeded: ${pistol.name}, ${shotgun.name}, ${smg.name}`);

  // --- Monsters ---
  const strayDog = await prisma.monster.upsert({
    where: { id: 1 },
    update: { attackSpeed: 0.4 },
    create: {
      name: 'Stray Dog',
      maxHp: 30,
      damage: 5,
      attackSpeed: 0.4,
      expReward: 10,
      goldReward: 5,
    },
  });

  const bandit = await prisma.monster.upsert({
    where: { id: 2 },
    update: { attackSpeed: 0.5 },
    create: {
      name: 'Bandit',
      maxHp: 60,
      damage: 12,
      attackSpeed: 0.5,
      expReward: 25,
      goldReward: 15,
    },
  });

  const wolf = await prisma.monster.upsert({
    where: { id: 3 },
    update: { attackSpeed: 0.9 },
    create: {
      name: 'Wolf',
      maxHp: 80,
      damage: 18,
      attackSpeed: 0.9,
      expReward: 40,
      goldReward: 20,
    },
  });

  const ghoul = await prisma.monster.upsert({
    where: { id: 4 },
    update: { attackSpeed: 0.6 },
    create: {
      name: 'Ghoul',
      maxHp: 120,
      damage: 25,
      attackSpeed: 0.6,
      expReward: 70,
      goldReward: 35,
    },
  });

  const mutant = await prisma.monster.upsert({
    where: { id: 5 },
    update: { attackSpeed: 0.5 },
    create: {
      name: 'Mutant',
      maxHp: 200,
      damage: 40,
      attackSpeed: 0.5,
      expReward: 120,
      goldReward: 60,
    },
  });

  console.log(`Monsters seeded: ${[strayDog, bandit, wolf, ghoul, mutant].map((m) => m.name).join(', ')}`);

  // --- Locations ---
  const abandonedCity = await prisma.location.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Abandoned City',
      description: 'A ruined city overrun by bandits and stray animals.',
      minLevel: 1,
    },
  });

  const darkForest = await prisma.location.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Dark Forest',
      description: 'An ancient forest where unnatural creatures roam at night.',
      minLevel: 5,
    },
  });

  const wasteland = await prisma.location.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Toxic Wasteland',
      description: 'A radioactive wasteland filled with mutated horrors.',
      minLevel: 10,
    },
  });

  console.log(`Locations seeded: ${[abandonedCity, darkForest, wasteland].map((l) => l.name).join(', ')}`);

  // --- Sub-Locations: Abandoned City ---
  const cityGates = await prisma.subLocation.upsert({
    where: { id: 1 },
    update: {},
    create: {
      locationId: abandonedCity.id,
      name: 'City Gates',
      description: 'The entrance to the abandoned city. Relatively safe.',
      isSafe: true,
      minLevel: 1,
    },
  });

  const cityOutskirts = await prisma.subLocation.upsert({
    where: { id: 2 },
    update: {},
    create: {
      locationId: abandonedCity.id,
      name: 'City Outskirts',
      description: 'The outskirts are prowled by stray dogs.',
      isSafe: false,
      minLevel: 1,
    },
  });

  const cityCenter = await prisma.subLocation.upsert({
    where: { id: 3 },
    update: {},
    create: {
      locationId: abandonedCity.id,
      name: 'City Center',
      description: 'Bandits have made this their home.',
      isSafe: false,
      minLevel: 3,
    },
  });

  // --- Sub-Locations: Dark Forest ---
  const forestEdge = await prisma.subLocation.upsert({
    where: { id: 4 },
    update: {},
    create: {
      locationId: darkForest.id,
      name: 'Forest Edge',
      description: 'The edge of the forest. Safe to rest here.',
      isSafe: true,
      minLevel: 5,
    },
  });

  const deepForest = await prisma.subLocation.upsert({
    where: { id: 5 },
    update: {},
    create: {
      locationId: darkForest.id,
      name: 'Deep Forest',
      description: 'Wolves hunt in packs here.',
      isSafe: false,
      minLevel: 5,
    },
  });

  const forestRuins = await prisma.subLocation.upsert({
    where: { id: 6 },
    update: {},
    create: {
      locationId: darkForest.id,
      name: 'Forest Ruins',
      description: 'Ancient ruins crawling with ghouls.',
      isSafe: false,
      minLevel: 8,
    },
  });

  // --- Sub-Locations: Toxic Wasteland ---
  const wastelandCamp = await prisma.subLocation.upsert({
    where: { id: 7 },
    update: {},
    create: {
      locationId: wasteland.id,
      name: 'Survivor Camp',
      description: 'A small camp of survivors. Safe to rest.',
      isSafe: true,
      minLevel: 10,
    },
  });

  const wastelandZone = await prisma.subLocation.upsert({
    where: { id: 8 },
    update: {},
    create: {
      locationId: wasteland.id,
      name: 'Contaminated Zone',
      description: 'Mutants roam this toxic hellscape.',
      isSafe: false,
      minLevel: 10,
    },
  });

  console.log(`Sub-locations seeded: ${[cityGates, cityOutskirts, cityCenter, forestEdge, deepForest, forestRuins, wastelandCamp, wastelandZone].map((s) => s.name).join(', ')}`);

  // --- Monster Spawns ---
  // City Outskirts: Stray Dogs (high weight) + Bandits (low weight)
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: cityOutskirts.id, monsterId: strayDog.id } },
    update: {},
    create: { subLocationId: cityOutskirts.id, monsterId: strayDog.id, spawnWeight: 80 },
  });
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: cityOutskirts.id, monsterId: bandit.id } },
    update: {},
    create: { subLocationId: cityOutskirts.id, monsterId: bandit.id, spawnWeight: 20 },
  });

  // City Center: Bandits only
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: cityCenter.id, monsterId: bandit.id } },
    update: {},
    create: { subLocationId: cityCenter.id, monsterId: bandit.id, spawnWeight: 100 },
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

  // Contaminated Zone: Mutants
  await prisma.subLocationMonster.upsert({
    where: { subLocationId_monsterId: { subLocationId: wastelandZone.id, monsterId: mutant.id } },
    update: {},
    create: { subLocationId: wastelandZone.id, monsterId: mutant.id, spawnWeight: 100 },
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
