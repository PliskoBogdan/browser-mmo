-- CreateEnum
CREATE TYPE "EquipmentSlot" AS ENUM ('WEAPON', 'HELMET', 'BODY', 'PANTS', 'GLOVES');

-- DropForeignKey
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_primaryWeaponId_fkey";

-- DropForeignKey
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_secondaryWeaponId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accuracy" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "agility" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "criticalDamage" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "defense" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "endurance" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "hpUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "perkPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "strength" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Monster" ADD COLUMN     "defense" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Equipment";

-- DropTable
DROP TABLE "Weapon";

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slot" "EquipmentSlot" NOT NULL,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "description" TEXT,
    "sellValue" INTEGER NOT NULL DEFAULT 0,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "agility" INTEGER NOT NULL DEFAULT 0,
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "endurance" INTEGER NOT NULL DEFAULT 0,
    "criticalDamage" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "baseDamage" INTEGER NOT NULL DEFAULT 0,
    "attackSpeed" DOUBLE PRECISION,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEquipment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "equipmentItemId" INTEGER NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerk" (
    "userId" INTEGER NOT NULL,
    "perkCode" TEXT NOT NULL,

    CONSTRAINT "UserPerk_pkey" PRIMARY KEY ("userId","perkCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentItem_name_key" ON "EquipmentItem"("name");

-- CreateIndex
CREATE INDEX "UserEquipment_userId_idx" ON "UserEquipment"("userId");

-- AddForeignKey
ALTER TABLE "UserEquipment" ADD CONSTRAINT "UserEquipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEquipment" ADD CONSTRAINT "UserEquipment_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerk" ADD CONSTRAINT "UserPerk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
