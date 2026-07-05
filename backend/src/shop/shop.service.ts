import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterService } from '../character/character.service';
import type { CoreStat, EquipmentSlot } from '@my/shared';
import { CORE_STATS } from '../character/stats.constants';

interface UserPosition {
  currentLocationId: number | null;
  posX: number;
  posY: number;
}

interface ShopSubLocation {
  kind: string;
  locationId: number;
  gridX: number;
  gridY: number;
}

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private character: CharacterService,
  ) {}

  async listForSubLocation(userId: number, subLocationId: number) {
    const [user, subLocation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, level: true, currentLocationId: true, posX: true, posY: true } }),
      this.prisma.subLocation.findUnique({
        where: { id: subLocationId },
        include: { shopListings: { include: { equipmentItem: true } } },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    this.assertAtShop(user, subLocation);

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
    const [user, subLocation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, currentLocationId: true, posX: true, posY: true } }),
      this.prisma.subLocation.findUnique({ where: { id: subLocationId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    this.assertAtShop(user, subLocation);

    const listing = await this.prisma.shopListing.findUnique({
      where: { subLocationId_equipmentItemId: { subLocationId, equipmentItemId } },
      include: { equipmentItem: true },
    });
    if (!listing) throw new NotFoundException('That item is not sold here.');
    if (user.gold < listing.equipmentItem.price) throw new BadRequestException('Not enough gold.');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { gold: { decrement: listing.equipmentItem.price } } }),
      this.prisma.userEquipment.create({ data: { userId, equipmentItemId, equipped: false } }),
    ]);

    return this.character.getMe(userId);
  }

  // Weapon/armor shops are a separate physical tile from loot buyers by
  // design (see LOOT_SHOP) — the player must actually be standing on this
  // shop's tile to browse or buy, not just know its id.
  private assertAtShop(user: UserPosition, subLocation: ShopSubLocation) {
    if (subLocation.kind !== 'SHOP') throw new BadRequestException('This location has no shop.');
    if (user.currentLocationId !== subLocation.locationId || user.posX !== subLocation.gridX || user.posY !== subLocation.gridY) {
      throw new ForbiddenException('You must be at this shop to do that.');
    }
  }
}
