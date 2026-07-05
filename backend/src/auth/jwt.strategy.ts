import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => req?.cookies?.access_token ?? null]),
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub };
  }
}
