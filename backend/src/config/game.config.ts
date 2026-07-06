// Central game-balance configuration — every global scalar tunable lives here,
// grouped by domain, so the game is retuned from one place.
//
// What does NOT belong here: content definitions (perk/skill/status effects,
// monster AI profiles, rift tier layouts, seeded items). Those stay in their
// domain config files (perks.config.ts, skills.config.ts, rift.config.ts, …);
// this file only holds the numbers that scale or gate the systems.

export const GAME_CONFIG = {
  // Leveling curve and per-level grants.
  leveling: {
    // Exp needed to finish level N is N * expPerLevelMultiplier.
    expPerLevelMultiplier: 100,
    statPointsPerLevel: 3,
    // A perk point is granted every N levels.
    levelsPerPerkPoint: 3,
  },

  // Global reward scaling — applied on top of per-monster/per-tile rewards.
  // Raise for an exp/gold event weekend, lower to slow progression.
  rewards: {
    expMultiplier: 1,
    goldMultiplier: 1,
  },

  combat: {
    // Global damage scaling, applied when the battle engine context is built:
    // player* scales all player-dealt damage, monster* all monster-dealt.
    playerDamageMultiplier: 1,
    monsterDamageMultiplier: 1,

    // Derived-stat formula tunables (see CharacterStatsService.deriveCombat).
    baseMaxHp: 100,
    strengthHpMult: 10,
    strengthRegenMult: 0.2,
    strengthDamageMult: 0.5,
    maxEvasion: 0.6,
    maxCritChance: 0.75,
    maxDamageReduction: 0.7,

    // Lazy HP regen: one regen cycle elapses per this many ms.
    regenIntervalMs: 10_000,

    // Guard against pathological replay loops if a battle sat idle for ages.
    maxMonsterTicks: 1000,
  },

  // Travel stamina: the cost of moving through the open world.
  stamina: {
    // maxStamina = base + endurance * perEndurance (finally gives endurance a job).
    base: 100,
    perEndurance: 4,
    // Spent per world-map step. Movement inside locations and rifts is free.
    worldStepCost: 10,
    // There is NO passive regen while traveling: stamina comes back only at a
    // camp (below), at SAFE tiles (full restore) or from food.
    // Camping places a persistent campfire on the player's world cell; while
    // the owner stands on it, campRegenPerCycle is restored per interval.
    campRegenIntervalMs: 5_000,
    campRegenPerCycle: 5,
    // Setting up a new camp is gated by a cooldown; the fire itself burns out
    // after campLifetimeMs (the player can leave and return until then).
    campCooldownMs: 5 * 60 * 1000,
    campLifetimeMs: 30 * 60 * 1000,
    // Rolled when setting up: a wilderness monster interrupts the camp
    // instead (no fire placed, no cooldown consumed).
    campAmbushChance: 0.3,
  },

  death: {
    // Fleeing a battle costs this fraction of max HP (never drops below 1 HP).
    fleeHpPenaltyRatio: 0.2,
    // Resurrecting restores this fraction of max HP.
    resurrectHpRatio: 0.5,
    // Dying in a rift keeps ceil(quantity * ratio) of each staged loot stack.
    riftLootKeepRatio: 0.5,
  },

  rift: {
    // A rift rotates off the world map this long after spawning.
    lifetimeMs: 2 * 60 * 60 * 1000,
    monsterRespawnMs: 3 * 60 * 1000,
    resourceRespawnMs: 5 * 60 * 1000,
    // Bosses shouldn't feel farmable — much longer than a regular monster.
    bossRespawnMs: 20 * 60 * 1000,
    // Exploration exp per newly revealed tile: (base + depth) * tier.
    exploreExpBase: 2,
    // Deeper rooms drop fatter loot: flat % added to dropChance per depth step.
    lootChancePerDepth: 3,
    lootChanceCap: 95,
  },

  // Overworld grid bounds — shared by Locations and Rifts, since both occupy
  // the same map (see RiftWorldService.pickFreeCell).
  world: {
    width: 7,
    height: 5,
  },

  // Gear granted and auto-equipped on registration (must match seeded names).
  starterKit: {
    weaponName: 'Rusty Sword',
    armorNames: ['Leather Cap', 'Leather Jerkin', 'Leather Trousers', 'Worn Leather Gloves'],
  },
} as const;
