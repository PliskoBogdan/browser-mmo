import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterService } from '../character/character.service';
import type { CoreStat, EquipmentSlot } from '@my/shared';
import { CORE_STATS } from '../character/stats.constants';
import { assertStandingAt } from '../location/sub-location-presence';
import { grantItem } from '../inventory/inventory.util';

// Weapon/armor shops are a separate physical tile from loot buyers by design
// (see LOOT_SHOP) — the player must be standing on this shop's tile to browse
// or buy.
const SHOP_PRESENCE = { wrongKind: 'This location has no shop.', notPresent: 'You must be at this shop to do that.' };

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
        include: { shopListings: { include: { equipmentItem: true } }, shopItemListings: { include: { item: true } } },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    assertStandingAt(user, subLocation, 'SHOP', SHOP_PRESENCE);

    const equipment = subLocation.shopListings.map(({ equipmentItem: item }) => {
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

    // Consumables (e.g. Torch) — no slot/level gate, just gold.
    const items = subLocation.shopItemListings.map(({ item }) => ({
      itemId: item.id,
      name: item.name,
      description: item.description,
      rarity: item.rarity,
      price: item.buyPrice ?? 0,
      canAfford: user.gold >= (item.buyPrice ?? 0),
    }));

    return { equipment, items };
  }

  async buy(userId: number, subLocationId: number, equipmentItemId: number) {
    const [user, subLocation] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, currentLocationId: true, posX: true, posY: true } }), this.prisma.subLocation.findUnique({ where: { id: subLocationId } })]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    assertStandingAt(user, subLocation, 'SHOP', SHOP_PRESENCE);

    const listing = await this.prisma.shopListing.findUnique({
      where: { subLocationId_equipmentItemId: { subLocationId, equipmentItemId } },
      include: { equipmentItem: true },
    });
    if (!listing) throw new NotFoundException('That item is not sold here.');
    if (user.gold < listing.equipmentItem.price) throw new BadRequestException('Not enough gold.');

    await this.prisma.$transaction([this.prisma.user.update({ where: { id: userId }, data: { gold: { decrement: listing.equipmentItem.price } } }), this.prisma.userEquipment.create({ data: { userId, equipmentItemId, equipped: false } })]);

    return this.character.getMe(userId);
  }

  async buyItem(userId: number, subLocationId: number, itemId: number) {
    const [user, subLocation] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, currentLocationId: true, posX: true, posY: true } }), this.prisma.subLocation.findUnique({ where: { id: subLocationId } })]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    assertStandingAt(user, subLocation, 'SHOP', SHOP_PRESENCE);

    const listing = await this.prisma.shopItemListing.findUnique({
      where: { subLocationId_itemId: { subLocationId, itemId } },
      include: { item: true },
    });
    if (!listing || listing.item.buyPrice === null) throw new NotFoundException('That item is not sold here.');
    if (user.gold < listing.item.buyPrice) throw new BadRequestException('Not enough gold.');

    await this.prisma.$transaction([this.prisma.user.update({ where: { id: userId }, data: { gold: { decrement: listing.item.buyPrice } } }), grantItem(this.prisma, userId, itemId, 1)]);

    return { message: `Bought 1x ${listing.item.name}.` };
  }
}
