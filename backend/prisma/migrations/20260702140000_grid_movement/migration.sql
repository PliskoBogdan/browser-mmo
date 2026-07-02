-- CreateEnum
CREATE TYPE "SubLocationKind" AS ENUM ('SAFE', 'SHOP', 'DANGER');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "gridHeight" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "gridWidth" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "mapX" INTEGER NOT NULL,
ADD COLUMN     "mapY" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SubLocation" DROP COLUMN "isSafe",
ADD COLUMN     "gridX" INTEGER NOT NULL,
ADD COLUMN     "gridY" INTEGER NOT NULL,
ADD COLUMN     "kind" "SubLocationKind" NOT NULL DEFAULT 'DANGER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentLocationId" INTEGER,
ADD COLUMN     "posX" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "posY" INTEGER NOT NULL DEFAULT 2;

-- CreateIndex
CREATE UNIQUE INDEX "Location_mapX_mapY_key" ON "Location"("mapX", "mapY");

-- CreateIndex
CREATE UNIQUE INDEX "SubLocation_locationId_gridX_gridY_key" ON "SubLocation"("locationId", "gridX", "gridY");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

