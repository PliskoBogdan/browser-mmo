import { Module } from '@nestjs/common';
import { RiftController } from './rift.controller';
import { RiftService } from './rift.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BattleModule } from '../battle/battle.module';

@Module({
  imports: [PrismaModule, BattleModule],
  controllers: [RiftController],
  providers: [RiftService],
  exports: [RiftService],
})
export class RiftModule {}
