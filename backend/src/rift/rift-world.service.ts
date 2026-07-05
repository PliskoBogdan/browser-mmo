import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RiftRunStatus, RiftTileKind } from '../../prisma/generated/client/enums';
import { generateRift } from './rift-generator';
import { ACTIVE_RIFT_LIFETIME_MS, RIFT_KEY_ITEM_NAME, RIFT_TIERS, TORCH_ITEM_NAME, type RiftTierConfig } from './rift.config';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../location/world.config';

// Owns the rift's lifecycle on the overworld map: rotating expired rifts out,
// creating fresh ones, and placing them on a free map cell. Deliberately has
// no dependency on BattleModule (unlike RiftService/gameplay) so LocationModule
// can depend on this without creating a circular module graph.
@Injectable()
export class RiftWorldService {
  constructor(private prisma: PrismaService) {}

  // Lazy world rotation — no cron. Expired rifts with no one inside are
  // deleted (cascades tiles/runs/fog), and each tier is topped back up to one
  // open rift. Called from both the world map and the rift list endpoints.
  async ensureRotated(): Promise<void> {
    const now = new Date();
    await this.prisma.rift.deleteMany({
      where: { expiresAt: { lt: now }, runs: { none: { status: RiftRunStatus.ACTIVE } } },
    });

    const active = await this.prisma.rift.findMany({ where: { expiresAt: { gt: now } }, select: { tier: true } });
    const activeTiers = new Set(active.map((r) => r.tier));

    for (const cfg of RIFT_TIERS) {
      if (!activeTiers.has(cfg.tier)) await this.createRift(cfg);
    }
  }

  private async createRift(cfg: RiftTierConfig) {
    // Postgres Int is signed 32-bit — cap the seed so it always fits.
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const generated = generateRift(seed, cfg.size);

    const itemNames = [TORCH_ITEM_NAME, RIFT_KEY_ITEM_NAME, ...cfg.resourceNames];
    const monsterNames = [...cfg.monsterNames, cfg.bossMonsterName];
    const [items, monsters, cell] = await Promise.all([this.prisma.item.findMany({ where: { name: { in: itemNames } } }), this.prisma.monster.findMany({ where: { name: { in: monsterNames } } }), this.pickFreeCell()]);
    const itemByName = new Map(items.map((i) => [i.name, i]));
    const monsterByName = new Map(monsters.map((m) => [m.name, m]));
    for (const name of itemNames) {
      if (!itemByName.has(name)) throw new Error(`Rift generation: item "${name}" is missing — run the seed first.`);
    }
    for (const name of monsterNames) {
      if (!monsterByName.has(name)) throw new Error(`Rift generation: monster "${name}" is missing — run the seed first.`);
    }
    const bossMonster = monsterByName.get(cfg.bossMonsterName)!;

    const name = cfg.namePool[Math.floor(Math.random() * cfg.namePool.length)];

    return this.prisma.rift.create({
      data: {
        name,
        tier: cfg.tier,
        minLevel: cfg.minLevel,
        seed,
        gridWidth: generated.width,
        gridHeight: generated.height,
        entranceX: generated.entranceX,
        entranceY: generated.entranceY,
        mapX: cell.x,
        mapY: cell.y,
        expiresAt: new Date(Date.now() + ACTIVE_RIFT_LIFETIME_MS),
        tiles: {
          create: generated.tiles.map((t) => ({
            x: t.x,
            y: t.y,
            kind: t.kind as RiftTileKind,
            name: t.name,
            depth: t.depth,
            roomId: t.roomId,
            requiredItemId: t.kind === 'LOCKED' ? itemByName.get(RIFT_KEY_ITEM_NAME)!.id : t.kind === 'DARK' ? itemByName.get(TORCH_ITEM_NAME)!.id : null,
            monsterId: t.kind === 'BOSS' ? bossMonster.id : t.monsterSlot !== undefined ? monsterByName.get(cfg.monsterNames[t.monsterSlot])!.id : null,
            // CHEST reuses the resource fields: it always gives the tier's
            // rarer resource item, plus the gold rolled by the generator.
            resourceItemId: t.kind === 'CHEST' ? itemByName.get(cfg.resourceNames[1])!.id : t.resourceSlot !== undefined ? itemByName.get(cfg.resourceNames[t.resourceSlot])!.id : null,
            maxCharges: t.maxCharges ?? 0,
            charges: t.maxCharges ?? 0,
            goldReward: t.kind === 'CHEST' ? (t.goldReward ?? 0) : 0,
          })),
        },
      },
    });
  }

  // Picks a random overworld cell not already occupied by a Location or an
  // active Rift. The grid has far more cells than seeded content, so this is
  // a simple scan rather than anything fancier.
  private async pickFreeCell(): Promise<{ x: number; y: number }> {
    const [locations, rifts] = await Promise.all([this.prisma.location.findMany({ select: { mapX: true, mapY: true } }), this.prisma.rift.findMany({ where: { expiresAt: { gt: new Date() } }, select: { mapX: true, mapY: true } })]);
    const occupied = new Set([...locations, ...rifts].map((p) => `${p.mapX},${p.mapY}`));

    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (!free.length) throw new Error('World map is full — no free cell for a new rift.');
    return free[Math.floor(Math.random() * free.length)];
  }
}
