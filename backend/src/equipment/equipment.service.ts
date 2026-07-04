import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterService } from '../character/character.service';
import type { CoreStat, EquipmentSlot } from '@my/shared';
import { CORE_STATS } from '../character/stats.constants';

@Injectable()
export class EquipmentService {
  constructor(
    private prisma: PrismaService,
    private character: CharacterService,
  ) {}

  async list(userId: number) {
    const owned = await this.prisma.userEquipment.findMany({
      where: { userId },
      include: { equipmentItem: true },
      orderBy: [{ equipped: 'desc' }, { equipmentItem: { slot: 'asc' } }],
    });

    return owned.map((o) => {
      const item = o.equipmentItem;
      const modifiers: Partial<Record<CoreStat, number>> = {};
      for (const stat of CORE_STATS) if (item[stat] !== 0) modifiers[stat] = item[stat];
      return {
        ownedId: o.id,
        itemId: item.id,
        name: item.name,
        slot: item.slot as EquipmentSlot,
        rarity: item.rarity,
        description: item.description,
        baseDamage: item.baseDamage,
        attackSpeed: item.attackSpeed,
        sellValue: item.sellValue,
        equipped: o.equipped,
        modifiers,
      };
    });
  }

  async equip(userId: number, ownedId: number) {
    const owned = await this.prisma.userEquipment.findUnique({
      where: { id: ownedId },
      include: { equipmentItem: true },
    });
    if (!owned || owned.userId !== userId) throw new NotFoundException("You don't own that item.");
    if (owned.equipped) throw new BadRequestException('That item is already equipped.');

    await this.assertNoActiveBattle(userId);

    const slot = owned.equipmentItem.slot;

    // Equipping swaps out whatever currently occupies the slot; the old item
    // stays owned (equipped=false) so it returns to the player's gear list.
    await this.prisma.$transaction([
      this.prisma.userEquipment.updateMany({
        where: { userId, equipped: true, equipmentItem: { slot } },
        data: { equipped: false },
      }),
      this.prisma.userEquipment.update({ where: { id: ownedId }, data: { equipped: true } }),
    ]);

    await this.character.syncMaxHp(userId);
    return this.character.getMe(userId);
  }

  async unequip(userId: number, slot: EquipmentSlot) {
    await this.assertNoActiveBattle(userId);

    const { count } = await this.prisma.userEquipment.updateMany({
      where: { userId, equipped: true, equipmentItem: { slot } },
      data: { equipped: false },
    });
    if (count === 0) throw new BadRequestException('Nothing equipped in that slot.');

    await this.character.syncMaxHp(userId);
    return this.character.getMe(userId);
  }

  private async assertNoActiveBattle(userId: number) {
    const active = await this.prisma.battle.findFirst({ where: { userId, status: 'ACTIVE' } });
    if (active) throw new ForbiddenException('You cannot change gear during a battle.');
  }
}
