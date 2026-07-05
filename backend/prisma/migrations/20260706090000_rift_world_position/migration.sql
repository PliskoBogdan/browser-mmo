-- AlterTable
-- Rift table is emptied first in dev (rifts are ephemeral, regenerated
-- lazily) so these can be added as NOT NULL directly.
ALTER TABLE "Rift" ADD COLUMN     "mapX" INTEGER NOT NULL,
ADD COLUMN     "mapY" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Rift_mapX_mapY_key" ON "Rift"("mapX", "mapY");
