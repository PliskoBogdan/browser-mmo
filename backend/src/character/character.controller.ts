import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { CharacterService } from './character.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { AllocateStatDto } from './dto/allocate-stat.dto';
import { UnlockPerkDto } from './dto/unlock-perk.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('character')
export class CharacterController {
  constructor(private characterService: CharacterService) {}

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.characterService.getMe(req.user.userId);
  }

  @Post('resurrect')
  @HttpCode(HttpStatus.OK)
  resurrect(@Req() req: AuthenticatedRequest) {
    return this.characterService.resurrect(req.user.userId);
  }

  @Post('stats/allocate')
  @HttpCode(HttpStatus.OK)
  allocateStat(@Req() req: AuthenticatedRequest, @Body() dto: AllocateStatDto) {
    return this.characterService.allocateStat(req.user.userId, dto.stat, dto.points ?? 1);
  }

  @Get('perks')
  listPerks(@Req() req: AuthenticatedRequest) {
    return this.characterService.listPerks(req.user.userId);
  }

  @Post('perks/unlock')
  @HttpCode(HttpStatus.OK)
  unlockPerk(@Req() req: AuthenticatedRequest, @Body() dto: UnlockPerkDto) {
    return this.characterService.unlockPerk(req.user.userId, dto.code);
  }
}
