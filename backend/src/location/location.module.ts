import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RiftWorldModule } from '../rift/rift-world.module';

@Module({
  imports: [PrismaModule, RiftWorldModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
