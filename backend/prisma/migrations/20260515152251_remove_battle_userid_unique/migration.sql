-- DropIndex
DROP INDEX "Battle_userId_key";

-- CreateIndex
CREATE INDEX "Battle_userId_idx" ON "Battle"("userId");
