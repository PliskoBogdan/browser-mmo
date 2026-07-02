import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

const STARTING_WEAPON_NAME = 'Pistol';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async register(email: string, username: string, password: string): Promise<string> {
    const [existingEmail, existingUsername] = await Promise.all([this.users.findByEmail(email), this.users.findByUsername(username)]);
    if (existingEmail) throw new ConflictException('An account with this email already exists.');
    if (existingUsername) throw new ConflictException('This username is already taken.');

    const hash = await bcrypt.hash(password, 10);

    // Находим стартовое оружие (Pistol должен быть в БД после seed)
    const startingWeapon = await this.prisma.weapon.findUnique({
      where: { name: STARTING_WEAPON_NAME },
    });

    const user = await this.users.create({
      email,
      username,
      password: hash,
      ...(startingWeapon ? { equipment: { create: { primaryWeaponId: startingWeapon.id } } } : {}),
    });

    return this.signToken(user.id);
  }

  async login(email: string, password: string): Promise<string> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException();

    return this.signToken(user.id);
  }

  private signToken(userId: number): string {
    return this.jwt.sign({ sub: userId });
  }
}
