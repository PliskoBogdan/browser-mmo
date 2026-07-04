import { Module } from '@nestjs/common';
import { BattleController } from './battle.controller';
import { BattleService } from './battle.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LocationModule } from '../location/location.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [PrismaModule, LocationModule, CharacterModule],
  controllers: [BattleController],
  providers: [BattleService],
})
export class BattleModule {}
