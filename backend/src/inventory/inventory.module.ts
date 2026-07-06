import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [PrismaModule, CharacterModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
