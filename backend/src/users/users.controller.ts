import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../auth/jwt-payload.interface';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@Req() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.userId);
  }
}
