import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CharacterStatsService } from './character-stats.service';
import { StaminaService } from './stamina.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterStatsService, StaminaService],
  exports: [CharacterStatsService, CharacterService, StaminaService],
})
export class CharacterModule {}
