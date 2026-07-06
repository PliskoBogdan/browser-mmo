import { Module } from '@nestjs/common';
import { CampController } from './camp.controller';
import { CampService } from './camp.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CharacterModule } from '../character/character.module';
import { BattleModule } from '../battle/battle.module';

@Module({
  imports: [PrismaModule, CharacterModule, BattleModule],
  controllers: [CampController],
  providers: [CampService],
})
export class CampModule {}
