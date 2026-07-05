import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RiftService } from './rift.service';
import { MoveDto } from '../location/dto/move.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('rifts')
export class RiftController {
  constructor(private riftService: RiftService) {}

  @Get('current')
  current(@Req() req: AuthenticatedRequest) {
    return this.riftService.current(req.user.userId);
  }

  @Post('move')
  @HttpCode(HttpStatus.OK)
  move(@Req() req: AuthenticatedRequest, @Body() body: MoveDto) {
    return this.riftService.move(req.user.userId, body.x, body.y);
  }

  @Post('gather')
  @HttpCode(HttpStatus.OK)
  gather(@Req() req: AuthenticatedRequest) {
    return this.riftService.gather(req.user.userId);
  }

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  extract(@Req() req: AuthenticatedRequest) {
    return this.riftService.extract(req.user.userId);
  }

  @Post(':id/enter')
  @HttpCode(HttpStatus.OK)
  enter(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.riftService.enter(req.user.userId, id);
  }
}
