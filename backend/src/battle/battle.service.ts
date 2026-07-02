import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from '../location/location.service';
import { BattleStatus, SubLocationKind } from '../../prisma/generated/client/enums';
import { AttackResultDto, EnterBattleResultDto } from './dto/attack-result.dto';

const EXP_PER_LEVEL_MULTIPLIER = 100;

@Injectable()
export class BattleService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
  ) {}

  async enterSubLocation(userId: number, subLocationId: number): Promise<EnterBattleResultDto> {
    const [user, subLocation] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { equipment: { include: { primaryWeapon: true } } },
      }),
      this.prisma.subLocation.findUnique({
        where: { id: subLocationId },
        include: {
          monsters: { include: { monster: true } },
        },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    if (user.isDead) throw new ForbiddenException('Your character is dead. Resurrect first.');
    if (!user.equipment?.primaryWeapon) throw new ForbiddenException('You have no weapon equipped.');

    if (user.level < subLocation.minLevel) {
      throw new ForbiddenException(`This area requires level ${subLocation.minLevel}. You are level ${user.level}.`);
    }

    if (subLocation.kind !== SubLocationKind.DANGER) {
      return {
        message: `You entered ${subLocation.name}. It's peaceful here.`,
        isSafe: true,
      };
    }

    if (subLocation.monsters.length === 0) {
      return {
        message: `You entered ${subLocation.name}. No enemies here right now.`,
        isSafe: true,
      };
    }

    // Если уже есть активный бой — вернуть текущее состояние
    const existingBattle = await this.prisma.battle.findFirst({
      where: { userId, status: BattleStatus.ACTIVE },
      include: { monster: true },
    });

    if (existingBattle && existingBattle.status === BattleStatus.ACTIVE) {
      const attackCooldownMs = Math.round((1 / user.equipment.primaryWeapon.attackSpeed) * 1000);
      return {
        message: 'You are already in a battle!',
        isSafe: false,
        battle: {
          id: existingBattle.id,
          monster: {
            id: existingBattle.monster.id,
            name: existingBattle.monster.name,
            maxHp: existingBattle.monster.maxHp,
            currentHp: existingBattle.monsterCurrentHp,
            damage: existingBattle.monster.damage,
            attackSpeed: existingBattle.monster.attackSpeed,
          },
          attackCooldownMs,
        },
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

    const attackCooldownMs = Math.round((1 / user.equipment.primaryWeapon.attackSpeed) * 1000);

    return {
      message: `You encountered a ${battle.monster.name}!`,
      isSafe: false,
      battle: {
        id: battle.id,
        monster: {
          id: battle.monster.id,
          name: battle.monster.name,
          maxHp: battle.monster.maxHp,
          currentHp: battle.monsterCurrentHp,
          damage: battle.monster.damage,
          attackSpeed: battle.monster.attackSpeed,
        },
        attackCooldownMs,
      },
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
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { equipment: { include: { primaryWeapon: true } } },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (user.isDead) throw new ForbiddenException('Your character is dead. Resurrect first.');
    if (!user.equipment?.primaryWeapon) throw new ForbiddenException('You have no weapon equipped.');
    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      throw new BadRequestException('You are not in an active battle.');
    }

    const now = new Date();
    const weapon = user.equipment.primaryWeapon;
    const monster = battle.monster;

    // --- Anti-cheat: enforce attack cooldown ---
    const attackCooldownMs = Math.round((1 / weapon.attackSpeed) * 1000);
    if (battle.lastPlayerAttackAt) {
      const elapsed = now.getTime() - battle.lastPlayerAttackAt.getTime();
      if (elapsed < attackCooldownMs) {
        const remainingMs = attackCooldownMs - elapsed;
        throw new HttpException({ message: 'Attack on cooldown', remainingMs }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // --- Calculate accumulated monster attacks since last check ---
    const monsterIntervalMs = Math.round((1 / monster.attackSpeed) * 1000);
    const timeSinceLastMonsterAttack = now.getTime() - battle.lastMonsterAttackAt.getTime();
    const monsterAttackTicks = Math.floor(timeSinceLastMonsterAttack / monsterIntervalMs);
    const monsterDamageDealt = monsterAttackTicks * monster.damage;

    let playerCurrentHp = Math.max(0, user.hp - monsterDamageDealt);
    const playerDied = playerCurrentHp <= 0;

    // --- Apply player damage to monster ---
    const playerDamageDealt = weapon.damage;
    const newMonsterHp = Math.max(0, battle.monsterCurrentHp - playerDamageDealt);
    const monsterDied = newMonsterHp <= 0;

    // Advance monster attack timer by consumed ticks only
    const newLastMonsterAttackAt = monsterAttackTicks > 0 ? new Date(battle.lastMonsterAttackAt.getTime() + monsterAttackTicks * monsterIntervalMs) : battle.lastMonsterAttackAt;

    let expGained = 0;
    let goldGained = 0;
    let leveledUp = false;
    let newPosition: { x: number; y: number } | undefined;
    let lootDrops: { name: string; quantity: number; rarity: string }[] = [];

    // Winning a fight sends the player back to the location's entry point rather
    // than leaving them stranded on the danger tile they just cleared, and rolls
    // the monster's loot table for anything worth carrying home.
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

        // Рассчитываем финальное HP с учётом смерти игрока
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

        await tx.user.update({
          where: { id: userId },
          data: { hp: 0, isDead: true },
        });
      } else {
        await tx.battle.update({
          where: { id: battle.id },
          data: {
            monsterCurrentHp: newMonsterHp,
            lastPlayerAttackAt: now,
            lastMonsterAttackAt: newLastMonsterAttackAt,
          },
        });

        if (monsterDamageDealt > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { hp: playerCurrentHp },
          });
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
      playerMaxHp: user.maxHp,
      battleStatus: finalStatus,
      expGained,
      goldGained,
      leveledUp,
      playerDied,
      attackCooldownMs,
      newPosition,
      lootDrops,
    };
  }

  async flee(userId: number) {
    const battle = await this.prisma.battle.findFirst({
      where: { userId, status: BattleStatus.ACTIVE },
    });

    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      throw new BadRequestException('You are not in an active battle.');
    }

    // Штраф за бегство: 20% от maxHp
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const fleePenalty = Math.floor(user.maxHp * 0.2);
    const newHp = Math.max(1, user.hp - fleePenalty);

    await this.prisma.$transaction([
      this.prisma.battle.delete({ where: { id: battle.id } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { hp: newHp },
      }),
    ]);

    return {
      message: 'You fled from battle!',
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
      },
    });

    if (!battle || battle.status !== BattleStatus.ACTIVE) {
      return { activeBattle: null };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { equipment: { include: { primaryWeapon: true } } },
    });

    const attackCooldownMs = user?.equipment?.primaryWeapon ? Math.round((1 / user.equipment.primaryWeapon.attackSpeed) * 1000) : 0;

    // Предварительно считаем накопленный урон монстра для информирования клиента
    const now = new Date();
    const monsterIntervalMs = Math.round((1 / battle.monster.attackSpeed) * 1000);
    const elapsed = now.getTime() - battle.lastMonsterAttackAt.getTime();
    const pendingMonsterTicks = Math.floor(elapsed / monsterIntervalMs);
    const pendingMonsterDamage = pendingMonsterTicks * battle.monster.damage;

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

  private pickMonsterByWeight(
    entries: {
      monster: {
        id: number;
        name: string;
        maxHp: number;
        damage: number;
        attackSpeed: number;
        expReward: number;
        goldReward: number;
      };
      spawnWeight: number;
    }[],
  ) {
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
