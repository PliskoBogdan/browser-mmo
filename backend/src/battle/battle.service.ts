import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from '../location/location.service';
import { BattleStatus, SubLocationKind } from '../../prisma/generated/client/enums';
import { AttackResultDto, EnterBattleResultDto } from './dto/attack-result.dto';
import { CharacterStatsService, STATS_INCLUDE, STAT_POINTS_PER_LEVEL } from '../character/character-stats.service';
import { perkPointsForLevel } from '../character/perks.config';

const EXP_PER_LEVEL_MULTIPLIER = 100;
// Guard against pathological loops if a player leaves a battle idle for a very
// long time before their next attack.
const MAX_MONSTER_TICKS = 1000;

@Injectable()
export class BattleService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
    private stats: CharacterStatsService,
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
      return {
        message: 'You are already in a battle!',
        isSafe: false,
        battle: this.battleView(existingBattle.id, existingBattle.monster, existingBattle.monsterCurrentHp, attackCooldownMs),
      };
    }

    const spawnedMonster = this.pickMonsterByWeight(subLocation.monsters);

    const battle = await this.prisma.battle.create({
      data: {
        userId,
        monsterId: spawnedMonster.monster.id,
        subLocationId,
        monsterCurrentHp: spawnedMonster.monster.maxHp,
        lastMonsterAttackAt: new Date(),
      },
      include: { monster: true },
    });

    return {
      message: `You encountered a ${battle.monster.name}!`,
      isSafe: false,
      battle: this.battleView(battle.id, battle.monster, battle.monsterCurrentHp, attackCooldownMs),
    };
  }

  async attack(userId: number): Promise<AttackResultDto> {
    const [battle, user] = await Promise.all([
      this.prisma.battle.findFirst({
        where: { userId, status: BattleStatus.ACTIVE },
        include: {
          monster: { include: { loot: { include: { item: true } } } },
          subLocation: { select: { locationId: true } },
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

    // --- Anti-cheat: enforce attack cooldown ---
    if (battle.lastPlayerAttackAt) {
      const elapsed = now.getTime() - battle.lastPlayerAttackAt.getTime();
      if (elapsed < attackCooldownMs) {
        throw new HttpException({ message: 'Attack on cooldown', remainingMs: attackCooldownMs - elapsed }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // --- Monster attacks accumulated since last check (evasion + player defense) ---
    const monsterIntervalMs = Math.round((1 / monster.attackSpeed) * 1000);
    const rawTicks = Math.floor((now.getTime() - battle.lastMonsterAttackAt.getTime()) / monsterIntervalMs);
    const playerDefReduction = CharacterStatsService.damageReduction(profile.final.defense);
    const perTickDamage = Math.max(1, Math.round(monster.damage * (1 - playerDefReduction)));

    let monsterDamageDealt = 0;
    let evaded = 0;
    const ticks = Math.min(rawTicks, MAX_MONSTER_TICKS);
    for (let i = 0; i < ticks; i++) {
      if (Math.random() < profile.combat.evasionChance) evaded++;
      else monsterDamageDealt += perTickDamage;
    }

    let playerCurrentHp = Math.max(0, user.hp - monsterDamageDealt);
    const playerDied = playerCurrentHp <= 0;

    // --- Player attacks monster (crit chance + crit multiplier + enemy defense) ---
    const isCrit = Math.random() < profile.combat.critChance;
    const monsterDefReduction = CharacterStatsService.damageReduction(monster.defense);
    const rawDamage = profile.combat.attackDamage * (isCrit ? profile.combat.critMultiplier : 1);
    const playerDamageDealt = Math.max(1, Math.round(rawDamage * (1 - monsterDefReduction)));
    const newMonsterHp = Math.max(0, battle.monsterCurrentHp - playerDamageDealt);
    const monsterDied = newMonsterHp <= 0;

    // Advance the monster's attack timer by the ticks that actually elapsed.
    const newLastMonsterAttackAt = rawTicks > 0 ? new Date(battle.lastMonsterAttackAt.getTime() + rawTicks * monsterIntervalMs) : battle.lastMonsterAttackAt;

    let expGained = 0;
    let goldGained = 0;
    let leveledUp = false;
    let statPointsGained = 0;
    let perkPointsGained = 0;
    let newPosition: { x: number; y: number } | undefined;
    let lootDrops: { name: string; quantity: number; rarity: string }[] = [];

    if (monsterDied && !playerDied) {
      newPosition = await this.locationService.getEntryPoint(battle.subLocation.locationId);
      lootDrops = this.rollLoot(monster.loot);
    }

    await this.prisma.$transaction(async (tx) => {
      if (monsterDied) {
        expGained = monster.expReward;
        goldGained = monster.goldReward;

        const newExp = user.exp + expGained;
        const newGold = user.gold + goldGained;
        const { level: newLevel, remainingExp } = this.calculateLevelUp(user.level, newExp);
        leveledUp = newLevel > user.level;
        statPointsGained = (newLevel - user.level) * STAT_POINTS_PER_LEVEL;
        perkPointsGained = perkPointsForLevel(newLevel) - perkPointsForLevel(user.level);

        const finalHp = playerDied ? 0 : playerCurrentHp;

        await tx.battle.delete({ where: { id: battle.id } });

        await tx.user.update({
          where: { id: userId },
          data: {
            exp: remainingExp,
            gold: newGold,
            level: newLevel,
            hp: finalHp,
            isDead: playerDied,
            statPoints: { increment: statPointsGained },
            perkPoints: { increment: perkPointsGained },
            ...(newPosition ? { posX: newPosition.x, posY: newPosition.y } : {}),
          },
        });

        for (const drop of monster.loot) {
          const dropped = lootDrops.find((d) => d.name === drop.item.name);
          if (!dropped) continue;
          await tx.inventoryItem.upsert({
            where: { userId_itemId: { userId, itemId: drop.itemId } },
            update: { quantity: { increment: dropped.quantity } },
            create: { userId, itemId: drop.itemId, quantity: dropped.quantity },
          });
        }

        if (playerDied) playerCurrentHp = 0;
      } else if (playerDied) {
        await tx.battle.delete({ where: { id: battle.id } });
        await tx.user.update({ where: { id: userId }, data: { hp: 0, isDead: true } });
      } else {
        await tx.battle.update({
          where: { id: battle.id },
          data: { monsterCurrentHp: newMonsterHp, lastPlayerAttackAt: now, lastMonsterAttackAt: newLastMonsterAttackAt },
        });
        if (monsterDamageDealt > 0) {
          await tx.user.update({ where: { id: userId }, data: { hp: playerCurrentHp } });
        }
      }
    });

    const finalStatus = monsterDied ? BattleStatus.WON : playerDied ? BattleStatus.LOST : BattleStatus.ACTIVE;

    return {
      playerDamageDealt,
      monsterDamageDealt,
      monsterCurrentHp: monsterDied ? 0 : newMonsterHp,
      monsterMaxHp: monster.maxHp,
      playerCurrentHp: playerDied ? 0 : playerCurrentHp,
      playerMaxHp: profile.combat.maxHp,
      battleStatus: finalStatus,
      isCrit,
      evaded,
      expGained,
      goldGained,
      leveledUp,
      statPointsGained,
      perkPointsGained,
      playerDied,
      attackCooldownMs,
      newPosition,
      lootDrops,
    };
  }

  async flee(userId: number) {
    const battle = await this.prisma.battle.findFirst({ where: { userId, status: BattleStatus.ACTIVE } });
    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      throw new BadRequestException('You are not in an active battle.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const fleePenalty = Math.floor(user.maxHp * 0.2);
    const newHp = Math.max(1, user.hp - fleePenalty);

    await this.prisma.$transaction([
      this.prisma.battle.delete({ where: { id: battle.id } }),
      this.prisma.user.update({ where: { id: userId }, data: { hp: newHp } }),
    ]);

    return { message: 'You fled from battle!', hpLost: fleePenalty, currentHp: newHp };
  }

  async getCurrentBattle(userId: number) {
    const battle = await this.prisma.battle.findFirst({
      where: { userId, status: BattleStatus.ACTIVE },
      include: { monster: true, subLocation: { include: { location: true } } },
    });

    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      return { activeBattle: null };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE });
    const profile = user ? this.stats.computeProfile(user) : null;
    const attackCooldownMs = profile?.combat.attackCooldownMs ?? 0;

    // Estimated pending monster damage after player defense (no evasion RNG here).
    const now = new Date();
    const monsterIntervalMs = Math.round((1 / battle.monster.attackSpeed) * 1000);
    const pendingTicks = Math.floor((now.getTime() - battle.lastMonsterAttackAt.getTime()) / monsterIntervalMs);
    const defReduction = profile ? CharacterStatsService.damageReduction(profile.final.defense) : 0;
    const pendingMonsterDamage = pendingTicks * Math.max(1, Math.round(battle.monster.damage * (1 - defReduction)));

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
        location: battle.subLocation.location.name,
        subLocation: battle.subLocation.name,
        pendingMonsterDamage,
        attackCooldownMs,
        startedAt: battle.createdAt,
      },
    };
  }

  // --- Helpers ---

  private battleView(
    id: number,
    monster: { id: number; name: string; maxHp: number; damage: number; attackSpeed: number },
    currentHp: number,
    attackCooldownMs: number,
  ) {
    return {
      id,
      monster: { id: monster.id, name: monster.name, maxHp: monster.maxHp, currentHp, damage: monster.damage, attackSpeed: monster.attackSpeed },
      attackCooldownMs,
    };
  }

  private pickMonsterByWeight(entries: { monster: { id: number; maxHp: number }; spawnWeight: number }[]) {
    const totalWeight = entries.reduce((sum, e) => sum + e.spawnWeight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
      roll -= entry.spawnWeight;
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
  }

  private calculateLevelUp(currentLevel: number, totalExp: number): { level: number; remainingExp: number } {
    let level = currentLevel;
    let exp = totalExp;
    while (exp >= level * EXP_PER_LEVEL_MULTIPLIER) {
      exp -= level * EXP_PER_LEVEL_MULTIPLIER;
      level++;
    }
    return { level, remainingExp: exp };
  }

  private rollLoot(
    loot: { itemId: number; dropChance: number; minQuantity: number; maxQuantity: number; item: { name: string; rarity: string } }[],
  ): { name: string; quantity: number; rarity: string }[] {
    const drops: { name: string; quantity: number; rarity: string }[] = [];
    for (const entry of loot) {
      if (Math.random() * 100 >= entry.dropChance) continue;
      const quantity = entry.minQuantity + Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1));
      drops.push({ name: entry.item.name, quantity, rarity: entry.item.rarity });
    }
    return drops;
  }
}
