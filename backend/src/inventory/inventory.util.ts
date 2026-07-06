import { Prisma } from '../../prisma/generated/client/client';

// Adds a stackable item to a user's inventory (creating the row on first
// pickup). Accepts either the PrismaService or an open transaction client, so
// grants can participate in larger atomic operations (battle loot, crafting,
// rift extraction).
export function grantItem(db: Pick<Prisma.TransactionClient, 'inventoryItem'>, userId: number, itemId: number, quantity: number) {
  return db.inventoryItem.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: { quantity: { increment: quantity } },
    create: { userId, itemId, quantity },
  });
}
