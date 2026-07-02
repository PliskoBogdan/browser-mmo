import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRegistrationPayload } from '@my/shared';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        hp: true,
        maxHp: true,
        level: true,
        exp: true,
        gold: true,
        createdAt: true,
      },
    });
  }

  create(
    data: UserRegistrationPayload & {
      equipment?: { create: { primaryWeaponId: number } };
    },
  ) {
    return this.prisma.user.create({ data });
  }
}
