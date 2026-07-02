import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { LocationService } from './location.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MoveDto } from './dto/move.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Get('world')
  getWorldMap(@Req() req: AuthenticatedRequest) {
    return this.locationService.getWorldMap(req.user.userId);
  }

  @Post('world/move')
  @HttpCode(HttpStatus.OK)
  moveOnWorld(@Req() req: AuthenticatedRequest, @Body() body: MoveDto) {
    return this.locationService.moveOnWorld(req.user.userId, body.x, body.y);
  }

  @Post('move')
  @HttpCode(HttpStatus.OK)
  moveInLocation(@Req() req: AuthenticatedRequest, @Body() body: MoveDto) {
    return this.locationService.moveInLocation(req.user.userId, body.x, body.y);
  }

  @Post('leave')
  @HttpCode(HttpStatus.OK)
  leaveLocation(@Req() req: AuthenticatedRequest) {
    return this.locationService.leaveLocation(req.user.userId);
  }

  @Get()
  findAll() {
    return this.locationService.findAll();
  }

  @Post(':id/enter')
  @HttpCode(HttpStatus.OK)
  enterLocation(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.locationService.enterLocation(req.user.userId, id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.locationService.findOne(id);
  }

  @Get(':id/sub-locations/:subId')
  findSubLocation(@Param('subId', ParseIntPipe) subId: number) {
    return this.locationService.findSubLocation(subId);
  }
}
