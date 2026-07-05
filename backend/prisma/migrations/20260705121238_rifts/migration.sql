-- CreateEnum
CREATE TYPE "RiftTileKind" AS ENUM ('ENTRANCE', 'PATH', 'MONSTER', 'RESOURCE', 'LOCKED', 'DARK');

-- CreateEnum
CREATE TYPE "RiftRunStatus" AS ENUM ('ACTIVE', 'EXTRACTED', 'DEAD');

-- DropForeignKey
ALTER TABLE "Battle" DROP CONSTRAINT "Battle_subLocationId_fkey";

-- AlterTable
ALTER TABLE "Battle" ADD COLUMN     "riftTileId" INTEGER,
ALTER COLUMN "subLocationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Rift" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "seed" INTEGER NOT NULL,
    "gridWidth" INTEGER NOT NULL,
    "gridHeight" INTEGER NOT NULL,
    "entranceX" INTEGER NOT NULL,
    "entranceY" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiftTile" (
    "id" SERIAL NOT NULL,
    "riftId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "kind" "RiftTileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "requiredItemId" INTEGER,
    "monsterId" INTEGER,
    "resourceItemId" INTEGER,
    "maxCharges" INTEGER NOT NULL DEFAULT 0,
    "charges" INTEGER NOT NULL DEFAULT 0,
    "respawnAt" TIMESTAMP(3),

    CONSTRAINT "RiftTile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiftRun" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "riftId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "status" "RiftRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "loot" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiftRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExploredTile" (
    "userId" INTEGER NOT NULL,
    "riftTileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserExploredTile_pkey" PRIMARY KEY ("userId","riftTileId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiftTile_riftId_x_y_key" ON "RiftTile"("riftId", "x", "y");

-- CreateIndex
CREATE INDEX "RiftRun_userId_status_idx" ON "RiftRun"("userId", "status");

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_subLocationId_fkey" FOREIGN KEY ("subLocationId") REFERENCES "SubLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_riftTileId_fkey" FOREIGN KEY ("riftTileId") REFERENCES "RiftTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiftTile" ADD CONSTRAINT "RiftTile_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "Rift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiftTile" ADD CONSTRAINT "RiftTile_requiredItemId_fkey" FOREIGN KEY ("requiredItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiftTile" ADD CONSTRAINT "RiftTile_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiftTile" ADD CONSTRAINT "RiftTile_resourceItemId_fkey" FOREIGN KEY ("resourceItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiftRun" ADD CONSTRAINT "RiftRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiftRun" ADD CONSTRAINT "RiftRun_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "Rift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExploredTile" ADD CONSTRAINT "UserExploredTile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExploredTile" ADD CONSTRAINT "UserExploredTile_riftTileId_fkey" FOREIGN KEY ("riftTileId") REFERENCES "RiftTile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
