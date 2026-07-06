import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellItemDto } from './dto/sell-item.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.list(req.user.userId);
  }

  @Post(':itemId/sell')
  @HttpCode(HttpStatus.OK)
  sell(@Req() req: AuthenticatedRequest, @Param('itemId', ParseIntPipe) itemId: number, @Body() body: SellItemDto) {
    return this.inventoryService.sell(req.user.userId, itemId, body.quantity);
  }

  @Post(':itemId/use')
  @HttpCode(HttpStatus.OK)
  use(@Req() req: AuthenticatedRequest, @Param('itemId', ParseIntPipe) itemId: number) {
    return this.inventoryService.use(req.user.userId, itemId);
  }
}
