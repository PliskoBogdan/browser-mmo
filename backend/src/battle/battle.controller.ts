import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleActionDto } from './dto/battle-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('battle')
export class BattleController {
  constructor(private battleService: BattleService) {}

  @Post('enter/:subLocationId')
  @HttpCode(HttpStatus.OK)
  enter(@Req() req: AuthenticatedRequest, @Param('subLocationId', ParseIntPipe) subLocationId: number) {
    return this.battleService.enterSubLocation(req.user.userId, subLocationId);
  }

  // Legacy basic attack; equivalent to action { skill: 'strike' }.
  @Post('attack')
  @HttpCode(HttpStatus.OK)
  attack(@Req() req: AuthenticatedRequest) {
    return this.battleService.attack(req.user.userId);
  }

  @Post('action')
  @HttpCode(HttpStatus.OK)
  action(@Req() req: AuthenticatedRequest, @Body() dto: BattleActionDto) {
    return this.battleService.action(req.user.userId, dto.skill);
  }

  @Post('flee')
  @HttpCode(HttpStatus.OK)
  flee(@Req() req: AuthenticatedRequest) {
    return this.battleService.flee(req.user.userId);
  }

  @Get('current')
  getCurrent(@Req() req: AuthenticatedRequest) {
    return this.battleService.getCurrentBattle(req.user.userId);
  }
}
