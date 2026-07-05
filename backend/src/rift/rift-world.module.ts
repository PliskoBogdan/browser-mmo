import { Module } from '@nestjs/common';
import { RiftWorldService } from './rift-world.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RiftWorldService],
  exports: [RiftWorldService],
})
export class RiftWorldModule {}
