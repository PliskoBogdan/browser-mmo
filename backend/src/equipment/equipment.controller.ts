import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { EquipDto, UnequipDto } from './dto/equip.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private equipmentService: EquipmentService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.equipmentService.list(req.user.userId);
  }

  @Post('equip')
  @HttpCode(HttpStatus.OK)
  equip(@Req() req: AuthenticatedRequest, @Body() dto: EquipDto) {
    return this.equipmentService.equip(req.user.userId, dto.ownedId);
  }

  @Post('unequip')
  @HttpCode(HttpStatus.OK)
  unequip(@Req() req: AuthenticatedRequest, @Body() dto: UnequipDto) {
    return this.equipmentService.unequip(req.user.userId, dto.slot);
  }
}
