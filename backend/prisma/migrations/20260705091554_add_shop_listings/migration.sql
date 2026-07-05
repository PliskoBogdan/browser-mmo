-- AlterTable
ALTER TABLE "EquipmentItem" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "minLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ShopListing" (
    "id" SERIAL NOT NULL,
    "subLocationId" INTEGER NOT NULL,
    "equipmentItemId" INTEGER NOT NULL,

    CONSTRAINT "ShopListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopListing_subLocationId_equipmentItemId_key" ON "ShopListing"("subLocationId", "equipmentItemId");

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_subLocationId_fkey" FOREIGN KEY ("subLocationId") REFERENCES "SubLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
