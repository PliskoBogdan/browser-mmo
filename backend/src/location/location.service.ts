import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.location.findMany({
      include: {
        subLocations: {
          include: {
            monsters: {
              include: { monster: true },
            },
          },
        },
      },
      orderBy: { minLevel: 'asc' },
    });
  }

  async findOne(id: number) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        subLocations: {
          include: {
            monsters: {
              include: { monster: true },
            },
          },
        },
      },
    });

    if (!location) throw new NotFoundException(`Location #${id} not found`);

    return location;
  }

  async findSubLocation(subLocationId: number) {
    const sub = await this.prisma.subLocation.findUnique({
      where: { id: subLocationId },
      include: {
        location: true,
        monsters: {
          include: { monster: true },
        },
      },
    });

    if (!sub) throw new NotFoundException(`SubLocation #${subLocationId} not found`);

    return sub;
  }
}
