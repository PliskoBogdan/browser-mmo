-- AlterEnum
ALTER TYPE "RiftTileKind" ADD VALUE 'BOSS';
ALTER TYPE "RiftTileKind" ADD VALUE 'CHEST';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "buyPrice" INTEGER;

-- AlterTable
-- Rift/RiftTile tables are emptied first in dev (rifts are ephemeral,
-- regenerated lazily), so these can be added directly.
ALTER TABLE "RiftTile" ADD COLUMN     "roomId" INTEGER,
ADD COLUMN     "goldReward" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ShopItemListing" (
    "id" SERIAL NOT NULL,
    "subLocationId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "ShopItemListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopItemListing_subLocationId_itemId_key" ON "ShopItemListing"("subLocationId", "itemId");

-- AddForeignKey
ALTER TABLE "ShopItemListing" ADD CONSTRAINT "ShopItemListing_subLocationId_fkey" FOREIGN KEY ("subLocationId") REFERENCES "SubLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopItemListing" ADD CONSTRAINT "ShopItemListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
