import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { CraftingService } from './crafting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { CraftDto } from './dto/craft.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('crafting')
export class CraftingController {
  constructor(private craftingService: CraftingService) {}

  @Get(':subLocationId')
  list(@Req() req: AuthenticatedRequest, @Param('subLocationId', ParseIntPipe) subLocationId: number) {
    return this.craftingService.listForForge(req.user.userId, subLocationId);
  }

  @Post(':subLocationId/craft')
  @HttpCode(HttpStatus.OK)
  craft(@Req() req: AuthenticatedRequest, @Param('subLocationId', ParseIntPipe) subLocationId: number, @Body() dto: CraftDto) {
    return this.craftingService.craft(req.user.userId, subLocationId, dto.recipeId);
  }
}
