import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { BuyItemDto } from './dto/buy-item.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('shop')
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Get(':subLocationId')
  list(@Req() req: AuthenticatedRequest, @Param('subLocationId', ParseIntPipe) subLocationId: number) {
    return this.shopService.listForSubLocation(req.user.userId, subLocationId);
  }

  @Post(':subLocationId/buy')
  @HttpCode(HttpStatus.OK)
  buy(@Req() req: AuthenticatedRequest, @Param('subLocationId', ParseIntPipe) subLocationId: number, @Body() dto: BuyItemDto) {
    return this.shopService.buy(req.user.userId, subLocationId, dto.equipmentItemId);
  }
}
