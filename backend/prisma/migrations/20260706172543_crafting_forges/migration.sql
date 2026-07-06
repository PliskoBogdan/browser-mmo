-- AlterEnum
ALTER TYPE "SubLocationKind" ADD VALUE 'FORGE';

-- CreateTable
CREATE TABLE "CraftingRecipe" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goldCost" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "resultEquipmentId" INTEGER,
    "resultItemId" INTEGER,
    "resultQuantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CraftingRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraftingIngredient" (
    "recipeId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CraftingIngredient_pkey" PRIMARY KEY ("recipeId","itemId")
);

-- CreateTable
CREATE TABLE "ForgeListing" (
    "id" SERIAL NOT NULL,
    "subLocationId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,

    CONSTRAINT "ForgeListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CraftingRecipe_name_key" ON "CraftingRecipe"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ForgeListing_subLocationId_recipeId_key" ON "ForgeListing"("subLocationId", "recipeId");

-- AddForeignKey
ALTER TABLE "CraftingRecipe" ADD CONSTRAINT "CraftingRecipe_resultEquipmentId_fkey" FOREIGN KEY ("resultEquipmentId") REFERENCES "EquipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftingRecipe" ADD CONSTRAINT "CraftingRecipe_resultItemId_fkey" FOREIGN KEY ("resultItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftingIngredient" ADD CONSTRAINT "CraftingIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "CraftingRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftingIngredient" ADD CONSTRAINT "CraftingIngredient_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForgeListing" ADD CONSTRAINT "ForgeListing_subLocationId_fkey" FOREIGN KEY ("subLocationId") REFERENCES "SubLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForgeListing" ADD CONSTRAINT "ForgeListing_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "CraftingRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
