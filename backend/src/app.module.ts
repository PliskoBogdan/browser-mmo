import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { LocationModule } from './location/location.module';
import { BattleModule } from './battle/battle.module';
import { CharacterModule } from './character/character.module';
import { InventoryModule } from './inventory/inventory.module';
import { EquipmentModule } from './equipment/equipment.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, UsersModule, LocationModule, BattleModule, CharacterModule, InventoryModule, EquipmentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
