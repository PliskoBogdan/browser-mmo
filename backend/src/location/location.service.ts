import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattleStatus, RiftRunStatus, SubLocationKind } from '../../prisma/generated/client/enums';
import { RiftWorldService } from '../rift/rift-world.service';
import { WORLD_WIDTH, WORLD_HEIGHT } from './world.config';

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private riftWorld: RiftWorldService,
  ) {}

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

  // --- World map (overworld grid) ---

  async getWorldMap(userId: number) {
    const user = await this.getUserOrThrow(userId);
    await this.riftWorld.ensureRotated();

    const [locations, rifts] = await Promise.all([
      this.prisma.location.findMany({
        select: { id: true, name: true, description: true, minLevel: true, mapX: true, mapY: true },
      }),
      this.prisma.rift.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { id: true, name: true, tier: true, minLevel: true, mapX: true, mapY: true, expiresAt: true },
      }),
    ]);

    return {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      locations: locations.map((l) => ({ ...l, locked: user.level < l.minLevel })),
      rifts: rifts.map((r) => ({ ...r, expiresAt: r.expiresAt.toISOString(), locked: user.level < r.minLevel })),
    };
  }

  async moveOnWorld(userId: number, x: number, y: number) {
    const user = await this.getUserOrThrow(userId);

    if (user.currentLocationId !== null) {
      throw new BadRequestException('You are inside a location. Leave it first.');
    }
    await this.assertNoActiveBattle(userId);
    await this.assertNoActiveRiftRun(userId);
    this.assertInBounds(x, y, WORLD_WIDTH, WORLD_HEIGHT);
    this.assertAdjacent(user.posX, user.posY, x, y);

    await this.prisma.user.update({ where: { id: userId }, data: { posX: x, posY: y } });

    const [location, rift] = await Promise.all([
      this.prisma.location.findUnique({
        where: { mapX_mapY: { mapX: x, mapY: y } },
        select: { id: true, name: true, description: true, minLevel: true },
      }),
      this.prisma.rift.findFirst({
        where: { mapX: x, mapY: y, expiresAt: { gt: new Date() } },
        select: { id: true, name: true, tier: true, minLevel: true, expiresAt: true },
      }),
    ]);

    return {
      position: { locationId: null, x, y },
      location: location ? { ...location, locked: user.level < location.minLevel } : null,
      rift: rift ? { ...rift, mapX: x, mapY: y, expiresAt: rift.expiresAt.toISOString(), locked: user.level < rift.minLevel } : null,
    };
  }

  async enterLocation(userId: number, locationId: number) {
    const [user, location] = await Promise.all([this.getUserOrThrow(userId), this.findOne(locationId)]);

    if (user.currentLocationId !== null) {
      throw new BadRequestException('You are already inside a location.');
    }
    if (user.posX !== location.mapX || user.posY !== location.mapY) {
      throw new BadRequestException('You must travel to this location first.');
    }
    if (user.level < location.minLevel) {
      throw new ForbiddenException(`This area requires level ${location.minLevel}. You are level ${user.level}.`);
    }
    await this.assertNoActiveBattle(userId);
    await this.assertNoActiveRiftRun(userId);

    const { x: posX, y: posY } = this.computeEntryPoint(location.subLocations);

    await this.prisma.user.update({ where: { id: userId }, data: { currentLocationId: locationId, posX, posY } });

    return { locationId, position: { x: posX, y: posY } };
  }

  // Where a player lands when entering a location, and where they retreat to after winning a fight.
  async getEntryPoint(locationId: number): Promise<{ x: number; y: number }> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { subLocations: { select: { gridX: true, gridY: true, kind: true } } },
    });
    if (!location) return { x: 0, y: 0 };
    return this.computeEntryPoint(location.subLocations);
  }

  private computeEntryPoint(subLocations: { gridX: number; gridY: number; kind: SubLocationKind }[]): { x: number; y: number } {
    const entry = subLocations.find((s) => s.kind === SubLocationKind.SAFE || s.kind === SubLocationKind.SHOP || s.kind === SubLocationKind.LOOT_SHOP) ?? null;
    return { x: entry?.gridX ?? 0, y: entry?.gridY ?? 0 };
  }

  async moveInLocation(userId: number, x: number, y: number) {
    const user = await this.getUserOrThrow(userId);

    if (user.currentLocationId === null) {
      throw new BadRequestException('You are not inside a location.');
    }
    await this.assertNoActiveBattle(userId);

    const location = await this.findOne(user.currentLocationId);
    this.assertInBounds(x, y, location.gridWidth, location.gridHeight);
    this.assertAdjacent(user.posX, user.posY, x, y);

    const subLocation = location.subLocations.find((s) => s.gridX === x && s.gridY === y) ?? null;
    if (subLocation && user.level < subLocation.minLevel) {
      throw new ForbiddenException(`This area requires level ${subLocation.minLevel}. You are level ${user.level}.`);
    }

    await this.prisma.user.update({ where: { id: userId }, data: { posX: x, posY: y } });

    return {
      position: { x, y },
      subLocation: subLocation ? { id: subLocation.id, name: subLocation.name, description: subLocation.description, kind: subLocation.kind } : null,
    };
  }

  async leaveLocation(userId: number) {
    const user = await this.getUserOrThrow(userId);

    if (user.currentLocationId === null) {
      throw new BadRequestException('You are not inside a location.');
    }
    await this.assertNoActiveBattle(userId);

    const location = await this.findOne(user.currentLocationId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentLocationId: null, posX: location.mapX, posY: location.mapY },
    });

    return { position: { x: location.mapX, y: location.mapY } };
  }

  // --- Helpers ---

  private async getUserOrThrow(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertNoActiveBattle(userId: number) {
    const activeBattle = await this.prisma.battle.findFirst({ where: { userId, status: BattleStatus.ACTIVE } });
    if (activeBattle) throw new ForbiddenException('Resolve your current battle first.');
  }

  private async assertNoActiveRiftRun(userId: number) {
    const run = await this.prisma.riftRun.findFirst({ where: { userId, status: RiftRunStatus.ACTIVE }, select: { id: true } });
    if (run) throw new ForbiddenException('You are inside a rift. Extract from it first.');
  }

  private assertInBounds(x: number, y: number, width: number, height: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      throw new BadRequestException('Target tile is out of bounds.');
    }
  }

  private assertAdjacent(fromX: number, fromY: number, toX: number, toY: number) {
    const distance = Math.abs(fromX - toX) + Math.abs(fromY - toY);
    if (distance !== 1) {
      throw new BadRequestException('You can only move to an adjacent tile.');
    }
  }
}
