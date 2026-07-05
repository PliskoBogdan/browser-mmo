import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async list(userId: number) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { item: { rarity: 'desc' } },
    });

    return items.map((entry) => ({
      itemId: entry.itemId,
      name: entry.item.name,
      description: entry.item.description,
      rarity: entry.item.rarity,
      sellValue: entry.item.sellValue,
      quantity: entry.quantity,
    }));
  }

  async sell(userId: number, itemId: number, quantity: number) {
    if (quantity < 1) throw new BadRequestException('Quantity must be at least 1.');

    await this.assertAtLootShop(userId);

    const entry = await this.prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    });

    if (!entry) throw new NotFoundException("You don't have that item.");
    if (entry.quantity < quantity) throw new BadRequestException("You don't have that many.");

    const goldGained = entry.item.sellValue * quantity;
    const remaining = entry.quantity - quantity;

    await this.prisma.$transaction([remaining > 0 ? this.prisma.inventoryItem.update({ where: { id: entry.id }, data: { quantity: remaining } }) : this.prisma.inventoryItem.delete({ where: { id: entry.id } }), this.prisma.user.update({ where: { id: userId }, data: { gold: { increment: goldGained } } })]);

    return { message: `Sold ${quantity}x ${entry.item.name} for ${goldGained} gold.`, goldGained, remainingQuantity: Math.max(0, remaining) };
  }

  // Loot buyers (LOOT_SHOP) are a separate physical tile from weapon shops by
  // design — the player must be standing at one to sell loot for gold.
  private async assertAtLootShop(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { currentLocationId: true, posX: true, posY: true } });
    if (!user || user.currentLocationId === null) throw new ForbiddenException('You must be at a loot buyer to sell.');

    const subLocation = await this.prisma.subLocation.findUnique({
      where: { locationId_gridX_gridY: { locationId: user.currentLocationId, gridX: user.posX, gridY: user.posY } },
    });
    if (!subLocation || subLocation.kind !== 'LOOT_SHOP') throw new ForbiddenException('You must be at a loot buyer to sell.');
  }
}
