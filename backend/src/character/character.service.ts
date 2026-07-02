import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattleStatus } from '../../prisma/generated/client/enums';

const RESURRECT_HP_PERCENT = 0.5;

@Injectable()
export class CharacterService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        level: true,
        exp: true,
        gold: true,
        hp: true,
        maxHp: true,
        isDead: true,
        currentLocationId: true,
        posX: true,
        posY: true,
        equipment: {
          select: {
            primaryWeapon: { select: { id: true, name: true, damage: true, attackSpeed: true } },
            secondaryWeapon: { select: { id: true, name: true, damage: true, attackSpeed: true } },
          },
        },
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { currentLocationId, posX, posY, ...rest } = user;

    return {
      ...rest,
      position: { locationId: currentLocationId, x: posX, y: posY },
      expToNextLevel: user.level * 100,
      attackCooldownMs: user.equipment?.primaryWeapon ? Math.round((1 / user.equipment.primaryWeapon.attackSpeed) * 1000) : null,
    };
  }

  async resurrect(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');
    if (!user.isDead) throw new BadRequestException('Your character is not dead.');

    const restoredHp = Math.max(1, Math.floor(user.maxHp * RESURRECT_HP_PERCENT));

    // Воскрешение сбрасывает активный бой
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { hp: restoredHp, isDead: false },
      }),
      this.prisma.battle.updateMany({
        where: { userId, status: BattleStatus.ACTIVE },
        data: { status: BattleStatus.LOST },
      }),
    ]);

    return {
      message: 'You have been resurrected.',
      hp: restoredHp,
      maxHp: user.maxHp,
    };
  }
}
