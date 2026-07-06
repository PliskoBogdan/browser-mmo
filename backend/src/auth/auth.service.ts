import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterService } from '../character/character.service';
import { GAME_CONFIG } from '../config/game.config';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService,
    private character: CharacterService,
  ) {}

  async register(email: string, username: string, password: string): Promise<string> {
    const [existingEmail, existingUsername] = await Promise.all([this.users.findByEmail(email), this.users.findByUsername(username)]);
    if (existingEmail) throw new ConflictException('An account with this email already exists.');
    if (existingUsername) throw new ConflictException('This username is already taken.');

    const hash = await bcrypt.hash(password, 10);

    const user = await this.users.create({ email, username, password: hash });

    // Grant and auto-equip starter gear (seeded items). The weapon is equipped
    // so the character can fight immediately; armor gives a small stat head start.
    const starterItems = await this.prisma.equipmentItem.findMany({
      where: { name: { in: [GAME_CONFIG.starterKit.weaponName, ...GAME_CONFIG.starterKit.armorNames] } },
    });
    if (starterItems.length > 0) {
      await this.prisma.userEquipment.createMany({
        data: starterItems.map((item) => ({ userId: user.id, equipmentItemId: item.id, equipped: true })),
      });
      // Base strength drives maxHp, but starter armor may boost it too — sync it.
      await this.character.syncMaxHp(user.id);
    }

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
