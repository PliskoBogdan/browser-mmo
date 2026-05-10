import { Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { CharacterService } from './character.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

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
}
