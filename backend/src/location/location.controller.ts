import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { LocationService } from './location.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Get()
  findAll() {
    return this.locationService.findAll();
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
