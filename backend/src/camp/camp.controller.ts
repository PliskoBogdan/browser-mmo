import { Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { CampService } from './camp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('camp')
export class CampController {
  constructor(private campService: CampService) {}

  @Get()
  status(@Req() req: AuthenticatedRequest) {
    return this.campService.getStatus(req.user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  place(@Req() req: AuthenticatedRequest) {
    return this.campService.placeCamp(req.user.userId);
  }
}
