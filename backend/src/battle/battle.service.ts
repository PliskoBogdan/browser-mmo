import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from '../location/location.service';
import { BattleStatus, RiftRunStatus, RiftTileKind } from '../../prisma/generated/client/enums';
import { SubLocationKind } from '../../prisma/generated/client/enums';
import { Prisma } from '../../prisma/generated/client/client';
import { AttackResultDto, EnterBattleResultDto } from './dto/attack-result.dto';
import { CharacterProfile, CharacterStatsService, STATS_INCLUDE } from '../character/character-stats.service';
import { PERK_BY_CODE } from '../character/perks.config';
import { BattleRewardsService } from './battle-rewards.service';
import { addRiftLoot, parseRiftLoot } from '../rift/rift-loot';
import { grantItem } from '../inventory/inventory.util';
import { GAME_CONFIG } from '../config/game.config';
import { CombatResolver, createInitialState } from './engine/engine';
import { SKILL_BY_CODE } from './engine/skills.config';
import { resolveAiProfile } from './engine/monster-ai.config';
import { buildStateView } from './engine/views';
import type { BattleRuntimeState, EngineContext } from './engine/types';
import type { RiftLootEntry } from '@my/shared';

type MonsterRow = { name: string; maxHp: number; damage: number; defense: number; attackSpeed: number; aiProfile: string | null };

@Injectable()
export class BattleService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
    private stats: CharacterStatsService,
    private rewards: BattleRewardsService,
  ) {}

  async enterSubLocation(userId: number, subLocationId: number): Promise<EnterBattleResultDto> {
    const [user, subLocation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE }),
      this.prisma.subLocation.findUnique({
        where: { id: subLocationId },
        include: { monsters: { include: { monster: true } } },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    if (user.isDead) throw new ForbiddenException('Your character is dead. Resurrect first.');

    const profile = this.stats.computeProfile(user);
    if (profile.combat.attackCooldownMs === null) throw new ForbiddenException('You have no weapon equipped.');
    const attackCooldownMs = profile.combat.attackCooldownMs;

    if (user.level < subLocation.minLevel) {
      throw new ForbiddenException(`This area requires level ${subLocation.minLevel}. You are level ${user.level}.`);
    }

    if (subLocation.kind !== SubLocationKind.DANGER) {
      return { message: `You entered ${subLocation.name}. It's peaceful here.`, isSafe: true };
    }

    if (subLocation.monsters.length === 0) {
      return { message: `You entered ${subLocation.name}. No enemies here right now.`, isSafe: true };
    }

    const existingBattle = await this.prisma.battle.findFirst({
      where: { userId, status: BattleStatus.ACTIVE },
      include: { monster: true },
    });

    if (existingBattle && existingBattle.status === BattleStatus.ACTIVE) {
      const ctx = this.buildEngineContext(profile, existingBattle.monster, user.perks);
      const state = await this.loadState(existingBattle.id, existingBattle.state, ctx);
      return {
        message: 'You are already in a battle!',
        isSafe: false,
        battle: this.battleView(existingBattle.id, existingBattle.monster, existingBattle.monsterCurrentHp, attackCooldownMs, ctx, state),
      };
    }

    const spawnedMonster = this.pickMonsterByWeight(subLocation.monsters);
    const ctx = this.buildEngineContext(profile, spawnedMonster.monster, user.perks);
    const state = createInitialState(ctx);

    const battle = await this.prisma.battle.create({
      data: {
        userId,
        monsterId: spawnedMonster.monster.id,
        subLocationId,
        monsterCurrentHp: spawnedMonster.monster.maxHp,
        lastMonsterAttackAt: new Date(),
        state: state as unknown as Prisma.InputJsonValue,
      },
      include: { monster: true },
    });

    return {
      message: `You encountered a ${battle.monster.name}!`,
      isSafe: false,
      battle: this.battleView(battle.id, battle.monster, battle.monsterCurrentHp, attackCooldownMs, ctx, state),
    };
  }

  // Backwards-compatible basic attack.
  attack(userId: number): Promise<AttackResultDto> {
    return this.action(userId, 'strike');
  }

  async action(userId: number, skillCode: string): Promise<AttackResultDto> {
    const skill = SKILL_BY_CODE.get(skillCode);
    if (!skill) throw new BadRequestException(`Unknown skill: ${skillCode}`);

    const [battle, user] = await Promise.all([
      this.prisma.battle.findFirst({
        where: { userId, status: BattleStatus.ACTIVE },
        include: {
          monster: { include: { loot: { include: { item: true } } } },
          subLocation: { select: { locationId: true } },
          riftTile: { select: { id: true, depth: true, kind: true } },
        },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (user.isDead) throw new ForbiddenException('Your character is dead. Resurrect first.');

    const profile = this.stats.computeProfile(user);
    if (profile.combat.attackCooldownMs === null) throw new ForbiddenException('You have no weapon equipped.');
    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      throw new BadRequestException('You are not in an active battle.');
    }

    const now = new Date();
    const monster = battle.monster;
    const attackCooldownMs = profile.combat.attackCooldownMs;

    // --- Anti-cheat: enforce the global weapon cooldown between actions ---
    if (battle.lastPlayerAttackAt) {
      const elapsed = now.getTime() - battle.lastPlayerAttackAt.getTime();
      if (elapsed < attackCooldownMs) {
        throw new HttpException({ message: 'Attack on cooldown', remainingMs: attackCooldownMs - elapsed }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const ctx = this.buildEngineContext(profile, monster, user.perks);
    const state = (battle.state as unknown as BattleRuntimeState | null) ?? createInitialState(ctx);

    // --- Per-skill cooldown and momentum cost ---
    const readyAt = state.skillReadyAt[skill.code] ?? 0;
    if (now.getTime() < readyAt) {
      throw new HttpException({ message: `${skill.name} is on cooldown`, remainingMs: readyAt - now.getTime() }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (state.momentum < skill.momentumCost) {
      throw new BadRequestException(`${skill.name} needs ${skill.momentumCost} momentum (you have ${state.momentum}).`);
    }

    // --- Replay the monster ticks accumulated since the last action ---
    const monsterIntervalMs = Math.round((1 / monster.attackSpeed) * 1000);
    const rawTicks = Math.floor((now.getTime() - battle.lastMonsterAttackAt.getTime()) / monsterIntervalMs);
    // Guard against pathological replay loops if a battle sat idle for ages.
    const ticks = Math.min(rawTicks, GAME_CONFIG.combat.maxMonsterTicks);

    const resolver = new CombatResolver(ctx, state, user.hp, battle.monsterCurrentHp);
    resolver.resolveMonsterTicks(ticks);

    // The skill only fires if the replayed ticks didn't already end the fight.
    if (!resolver.playerDied && !resolver.monsterDied) {
      resolver.resolveSkill(skill);
      state.skillReadyAt[skill.code] = now.getTime() + Math.round(attackCooldownMs * skill.cooldownMult);
    }

    const monsterDied = resolver.monsterDied;
    const playerDied = resolver.playerDied;
    let playerCurrentHp = resolver.playerHp;
    const newMonsterHp = resolver.monsterHp;

    // Advance the monster's attack timer by the ticks that actually elapsed.
    const newLastMonsterAttackAt = rawTicks > 0 ? new Date(battle.lastMonsterAttackAt.getTime() + rawTicks * monsterIntervalMs) : battle.lastMonsterAttackAt;

    let expGained = 0;
    let goldGained = 0;
    let leveledUp = false;
    let statPointsGained = 0;
    let perkPointsGained = 0;
    let newPosition: { x: number; y: number } | undefined;
    let lootDrops: { name: string; quantity: number; rarity: string; banked?: boolean }[] = [];
    // Table loot (Wolf Pelt, etc.) is at-risk: staged in the run's bag,
    // banked only on extraction. Gate items (Torch/Rusty Key) are tools, not
    // treasure — they go straight to the real inventory so a torch found
    // deep in a rift can immediately unlock a door in that same run.
    let riftBagEntries: RiftLootEntry[] = [];
    let gateItemEntries: RiftLootEntry[] = [];
    let lostLoot: RiftLootEntry[] = [];

    if (monsterDied && !playerDied) {
      if (battle.riftTile) {
        const chanceBonus = battle.riftTile.depth * GAME_CONFIG.rift.lootChancePerDepth;
        const tableDrops = this.rewards.rollLoot(monster.loot, chanceBonus);
        riftBagEntries = tableDrops.map((d) => {
          const source = monster.loot.find((l) => l.item.name === d.name)!;
          return { itemId: source.itemId, name: d.name, rarity: d.rarity, quantity: d.quantity };
        });
        gateItemEntries = await this.rewards.rollRiftBonusDrops();
        lootDrops = [...riftBagEntries.map((e) => ({ name: e.name, quantity: e.quantity, rarity: e.rarity, banked: false })), ...gateItemEntries.map((e) => ({ name: e.name, quantity: e.quantity, rarity: e.rarity, banked: true }))];
      } else if (battle.subLocation) {
        newPosition = await this.locationService.getEntryPoint(battle.subLocation.locationId);
        lootDrops = this.rewards.rollLoot(monster.loot);
      } else {
        // Wilderness ambush (camping): loot rolls normally, no retreat move.
        lootDrops = this.rewards.rollLoot(monster.loot);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (monsterDied) {
        const kill = this.rewards.computeKillRewards(user, monster);
        expGained = kill.expGained;
        goldGained = kill.goldGained;
        leveledUp = kill.leveledUp;
        statPointsGained = kill.statPointsGained;
        perkPointsGained = kill.perkPointsGained;

        const finalHp = playerDied ? 0 : playerCurrentHp;

        await tx.battle.delete({ where: { id: battle.id } });

        await tx.user.update({
          where: { id: userId },
          data: {
            exp: kill.remainingExp,
            gold: user.gold + goldGained,
            level: kill.newLevel,
            hp: finalHp,
            isDead: playerDied,
            statPoints: { increment: statPointsGained },
            perkPoints: { increment: perkPointsGained },
            ...(newPosition ? { posX: newPosition.x, posY: newPosition.y } : {}),
          },
        });

        if (battle.riftTile) {
          // Shared world: the defeated monster stays gone for everyone until
          // it respawns. Bosses come back much slower — they shouldn't feel farmable.
          const respawnMs = battle.riftTile.kind === RiftTileKind.BOSS ? GAME_CONFIG.rift.bossRespawnMs : GAME_CONFIG.rift.monsterRespawnMs;
          await tx.riftTile.update({
            where: { id: battle.riftTile.id },
            data: { respawnAt: new Date(Date.now() + respawnMs) },
          });
          if (playerDied) {
            lostLoot = await this.rewards.applyRiftDeath(tx, userId);
          } else {
            if (riftBagEntries.length) {
              const run = await tx.riftRun.findFirst({ where: { userId, status: RiftRunStatus.ACTIVE } });
              if (run) {
                const merged = addRiftLoot(parseRiftLoot(run.loot), riftBagEntries);
                await tx.riftRun.update({ where: { id: run.id }, data: { loot: merged as unknown as Prisma.InputJsonValue } });
              }
            }
            for (const entry of gateItemEntries) {
              await grantItem(tx, userId, entry.itemId, entry.quantity);
            }
          }
        } else {
          for (const drop of monster.loot) {
            const dropped = lootDrops.find((d) => d.name === drop.item.name);
            if (!dropped) continue;
            await grantItem(tx, userId, drop.itemId, dropped.quantity);
          }
        }

        if (playerDied) playerCurrentHp = 0;
      } else if (playerDied) {
        await tx.battle.delete({ where: { id: battle.id } });
        await tx.user.update({ where: { id: userId }, data: { hp: 0, isDead: true } });
        if (battle.riftTile) lostLoot = await this.rewards.applyRiftDeath(tx, userId);
      } else {
        await tx.battle.update({
          where: { id: battle.id },
          data: {
            monsterCurrentHp: newMonsterHp,
            lastPlayerAttackAt: now,
            lastMonsterAttackAt: newLastMonsterAttackAt,
            state: state as unknown as Prisma.InputJsonValue,
          },
        });
        if (playerCurrentHp !== user.hp) {
          await tx.user.update({ where: { id: userId }, data: { hp: playerCurrentHp } });
        }
      }
    });

    const finalStatus = monsterDied ? BattleStatus.WON : playerDied ? BattleStatus.LOST : BattleStatus.ACTIVE;

    return {
      skillUsed: skill.code,
      playerDamageDealt: resolver.totalPlayerDamage,
      monsterDamageDealt: resolver.totalMonsterDamage,
      monsterCurrentHp: monsterDied ? 0 : newMonsterHp,
      monsterMaxHp: monster.maxHp,
      playerCurrentHp: playerDied ? 0 : playerCurrentHp,
      playerMaxHp: profile.combat.maxHp,
      battleStatus: finalStatus,
      isCrit: resolver.lastHitWasCrit,
      evaded: resolver.evaded,
      events: resolver.events,
      state: finalStatus === BattleStatus.ACTIVE ? buildStateView(ctx, state, now.getTime()) : null,
      expGained,
      goldGained,
      leveledUp,
      statPointsGained,
      perkPointsGained,
      playerDied,
      attackCooldownMs,
      newPosition,
      lootDrops,
      riftBattle: battle.riftTile !== null,
      lostLoot: lostLoot.length ? lostLoot.map((e) => ({ name: e.name, quantity: e.quantity, rarity: e.rarity })) : undefined,
    };
  }

  async flee(userId: number) {
    const battle = await this.prisma.battle.findFirst({
      where: { userId, status: BattleStatus.ACTIVE },
      include: { riftTile: { select: { rift: { select: { id: true, entranceX: true, entranceY: true } } } } },
    });
    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      throw new BadRequestException('You are not in an active battle.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const fleePenalty = Math.floor(user.maxHp * GAME_CONFIG.death.fleeHpPenaltyRatio);
    const newHp = Math.max(1, user.hp - fleePenalty);

    await this.prisma.$transaction(async (tx) => {
      await tx.battle.delete({ where: { id: battle.id } });
      await tx.user.update({ where: { id: userId }, data: { hp: newHp } });
      // Fleeing a rift fight throws you back to the entrance — retreating in
      // the dark has a cost beyond lost HP.
      if (battle.riftTile) {
        await tx.riftRun.updateMany({
          where: { userId, status: RiftRunStatus.ACTIVE },
          data: { x: battle.riftTile.rift.entranceX, y: battle.riftTile.rift.entranceY },
        });
      }
    });

    return {
      message: battle.riftTile ? 'You fled back to the rift entrance!' : 'You fled from battle!',
      hpLost: fleePenalty,
      currentHp: newHp,
    };
  }

  async getCurrentBattle(userId: number) {
    const battle = await this.prisma.battle.findFirst({
      where: { userId, status: BattleStatus.ACTIVE },
      include: {
        monster: true,
        subLocation: { include: { location: true } },
        riftTile: { select: { name: true, rift: { select: { name: true } } } },
      },
    });

    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      return { activeBattle: null };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE });
    if (!user) return { activeBattle: null };
    const profile = this.stats.computeProfile(user);
    const attackCooldownMs = profile.combat.attackCooldownMs ?? 0;

    const ctx = this.buildEngineContext(profile, battle.monster, user.perks);
    const state = await this.loadState(battle.id, battle.state, ctx);

    // Estimated pending monster damage after player defense (no evasion RNG here).
    const now = new Date();
    const monsterIntervalMs = Math.round((1 / battle.monster.attackSpeed) * 1000);
    const pendingTicks = Math.floor((now.getTime() - battle.lastMonsterAttackAt.getTime()) / monsterIntervalMs);
    const defReduction = CharacterStatsService.damageReduction(profile.final.defense);
    const pendingMonsterDamage = pendingTicks * Math.max(1, Math.round(ctx.monster.damage * (1 - defReduction)));

    return {
      activeBattle: {
        id: battle.id,
        monster: {
          id: battle.monster.id,
          name: battle.monster.name,
          currentHp: battle.monsterCurrentHp,
          maxHp: battle.monster.maxHp,
          damage: battle.monster.damage,
          attackSpeed: battle.monster.attackSpeed,
        },
        location: battle.subLocation?.location.name ?? (battle.riftTile ? `Rift: ${battle.riftTile.rift.name}` : 'Wilderness'),
        subLocation: battle.subLocation?.name ?? battle.riftTile?.name ?? 'Ambushed camp',
        riftBattle: battle.riftTile !== null,
        pendingMonsterDamage,
        attackCooldownMs,
        startedAt: battle.createdAt,
        state: buildStateView(ctx, state, now.getTime()),
      },
    };
  }

  // Called by RiftService when a player steps onto a tile with a living
  // monster. No weapon check here: getting ambushed unarmed is survivable —
  // the player can still flee.
  async startRiftBattle(userId: number, riftTileId: number): Promise<void> {
    const [user, tile, existing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE }),
      this.prisma.riftTile.findUnique({ where: { id: riftTileId }, include: { monster: true } }),
      this.prisma.battle.findFirst({ where: { userId, status: BattleStatus.ACTIVE }, select: { id: true } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!tile?.monster) throw new NotFoundException('There is no monster here.');
    if (existing) return;

    const profile = this.stats.computeProfile(user);
    const ctx = this.buildEngineContext(profile, tile.monster, user.perks);
    const state = createInitialState(ctx);

    await this.prisma.battle.create({
      data: {
        userId,
        monsterId: tile.monster.id,
        riftTileId: tile.id,
        monsterCurrentHp: tile.monster.maxHp,
        lastMonsterAttackAt: new Date(),
        state: state as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Called by CampService when a camping player rolls an ambush. Neither
  // subLocationId nor riftTileId is set — the fight happens in the open
  // wilderness. No weapon check: getting jumped unarmed is survivable, the
  // player can still flee.
  async startAmbushBattle(userId: number, monsterId: number): Promise<void> {
    const [user, monster, existing] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE }), this.prisma.monster.findUnique({ where: { id: monsterId } }), this.prisma.battle.findFirst({ where: { userId, status: BattleStatus.ACTIVE }, select: { id: true } })]);

    if (!user) throw new NotFoundException('User not found');
    if (!monster) throw new NotFoundException('Monster not found');
    if (existing) return;

    const profile = this.stats.computeProfile(user);
    const ctx = this.buildEngineContext(profile, monster, user.perks);
    const state = createInitialState(ctx);

    await this.prisma.battle.create({
      data: {
        userId,
        monsterId: monster.id,
        monsterCurrentHp: monster.maxHp,
        lastMonsterAttackAt: new Date(),
        state: state as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // --- Helpers ---

  // The global damage multipliers are applied here, when the engine context is
  // built — the engine itself stays pure and multiplier-free.
  private buildEngineContext(profile: CharacterProfile, monster: MonsterRow, perks: { perkCode: string }[]): EngineContext {
    const playerTriggers = perks.flatMap(({ perkCode }) => PERK_BY_CODE.get(perkCode)?.triggers ?? []);
    const combat = {
      ...profile.combat,
      attackDamage: Math.round(profile.combat.attackDamage * GAME_CONFIG.combat.playerDamageMultiplier),
    };
    return {
      player: { combat, defense: profile.final.defense },
      monster: {
        name: monster.name,
        maxHp: monster.maxHp,
        damage: Math.round(monster.damage * GAME_CONFIG.combat.monsterDamageMultiplier),
        defense: monster.defense,
        attackSpeed: monster.attackSpeed,
      },
      playerTriggers,
      monsterAi: resolveAiProfile(monster.aiProfile),
      rng: Math.random,
    };
  }

  // Battles created before the engine existed have no state — initialize and
  // persist one so intents/cooldowns stay stable across requests.
  private async loadState(battleId: number, raw: unknown, ctx: EngineContext): Promise<BattleRuntimeState> {
    if (raw) return raw as BattleRuntimeState;
    const state = createInitialState(ctx);
    await this.prisma.battle.update({ where: { id: battleId }, data: { state: state as unknown as Prisma.InputJsonValue } });
    return state;
  }

  private battleView(id: number, monster: { id: number; name: string; maxHp: number; damage: number; attackSpeed: number }, currentHp: number, attackCooldownMs: number, ctx: EngineContext, state: BattleRuntimeState) {
    return {
      id,
      monster: { id: monster.id, name: monster.name, maxHp: monster.maxHp, currentHp, damage: monster.damage, attackSpeed: monster.attackSpeed },
      attackCooldownMs,
      state: buildStateView(ctx, state, Date.now()),
    };
  }

  private pickMonsterByWeight<T extends { monster: { id: number; maxHp: number }; spawnWeight: number }>(entries: T[]): T {
    const totalWeight = entries.reduce((sum, e) => sum + e.spawnWeight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
      roll -= entry.spawnWeight;
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
  }
}
