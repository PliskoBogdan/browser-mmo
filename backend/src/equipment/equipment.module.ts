import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [PrismaModule, CharacterModule],
  controllers: [EquipmentController],
  providers: [EquipmentService],
})
export class EquipmentModule {}
