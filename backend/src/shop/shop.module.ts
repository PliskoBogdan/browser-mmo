import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [PrismaModule, CharacterModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
