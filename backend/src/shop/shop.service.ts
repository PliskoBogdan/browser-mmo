import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterService } from '../character/character.service';
import type { CoreStat, EquipmentSlot } from '@my/shared';
import { CORE_STATS } from '../character/stats.constants';

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private character: CharacterService,
  ) {}

  async listForSubLocation(userId: number, subLocationId: number) {
    const subLocation = await this.prisma.subLocation.findUnique({
      where: { id: subLocationId },
      include: { shopListings: { include: { equipmentItem: true } } },
    });
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    if (subLocation.kind !== 'SHOP') throw new BadRequestException('This location has no shop.');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, level: true } });
    if (!user) throw new NotFoundException('User not found');

    return subLocation.shopListings.map(({ equipmentItem: item }) => {
      const modifiers: Partial<Record<CoreStat, number>> = {};
      for (const stat of CORE_STATS) if (item[stat] !== 0) modifiers[stat] = item[stat];
      return {
        itemId: item.id,
        name: item.name,
        slot: item.slot as EquipmentSlot,
        rarity: item.rarity,
        description: item.description,
        icon: item.icon,
        baseDamage: item.baseDamage,
        attackSpeed: item.attackSpeed,
        price: item.price,
        minLevel: item.minLevel,
        modifiers,
        canAfford: user.gold >= item.price,
        meetsLevel: user.level >= item.minLevel,
      };
    });
  }

  async buy(userId: number, subLocationId: number, equipmentItemId: number) {
    const listing = await this.prisma.shopListing.findUnique({
      where: { subLocationId_equipmentItemId: { subLocationId, equipmentItemId } },
      include: { equipmentItem: true },
    });
    if (!listing) throw new NotFoundException('That item is not sold here.');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.gold < listing.equipmentItem.price) throw new BadRequestException('Not enough gold.');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { gold: { decrement: listing.equipmentItem.price } } }),
      this.prisma.userEquipment.create({ data: { userId, equipmentItemId, equipped: false } }),
    ]);

    return this.character.getMe(userId);
  }
}
