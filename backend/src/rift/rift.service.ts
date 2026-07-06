import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattleService } from '../battle/battle.service';
import { BattleStatus, RiftRunStatus, RiftTileKind } from '../../prisma/generated/client/enums';
import { Prisma } from '../../prisma/generated/client/client';
import type { RiftExtractResult, RiftGatherResult, RiftLootEntry, RiftMoveResult, RiftTileView, RiftView } from '@my/shared';
import { RIFT_KEY_ITEM_NAME, TORCH_ITEM_NAME } from './rift.config';
import { calculateLevelUp } from '../character/leveling';
import { perkPointsForLevel } from '../character/perks.config';
import { addRiftLoot, parseRiftLoot } from './rift-loot';
import { grantItem } from '../inventory/inventory.util';
import { GAME_CONFIG } from '../config/game.config';

type TileWithRefs = Prisma.RiftTileGetPayload<{
  include: { requiredItem: true; monster: true; resourceItem: true };
}>;

const TILE_INCLUDE = { requiredItem: true, monster: true, resourceItem: true } as const;

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

@Injectable()
export class RiftService {
  constructor(
    private prisma: PrismaService,
    private battleService: BattleService,
  ) {}

  // --- Run lifecycle ---

  async enter(userId: number, riftId: number): Promise<RiftView> {
    const [user, rift] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId } }), this.prisma.rift.findUnique({ where: { id: riftId } })]);
    if (!user) throw new NotFoundException('User not found');
    if (!rift || rift.expiresAt < new Date()) throw new NotFoundException('This rift has collapsed.');
    if (user.isDead) throw new ForbiddenException('Your character is dead. Resurrect first.');
    if (user.currentLocationId !== null) throw new BadRequestException('Leave your current location first.');

    const existing = await this.getActiveRun(userId);
    if (existing) {
      if (existing.riftId !== riftId) throw new BadRequestException('You are already inside another rift. Extract first.');
      return this.buildView(userId, existing.id);
    }

    if (user.posX !== rift.mapX || user.posY !== rift.mapY) {
      throw new BadRequestException('You must travel to this rift first.');
    }
    if (user.level < rift.minLevel) {
      throw new ForbiddenException(`This rift requires level ${rift.minLevel}. You are level ${user.level}.`);
    }
    await this.assertNoActiveBattle(userId);

    const entrance = await this.prisma.riftTile.findUnique({
      where: { riftId_x_y: { riftId, x: rift.entranceX, y: rift.entranceY } },
    });
    if (!entrance) throw new NotFoundException('Rift entrance not found.');

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.riftRun.create({
        data: { userId, riftId, x: rift.entranceX, y: rift.entranceY },
      });
      await tx.userExploredTile.upsert({
        where: { userId_riftTileId: { userId, riftTileId: entrance.id } },
        update: {},
        create: { userId, riftTileId: entrance.id },
      });
      return created;
    });

    return this.buildView(userId, run.id);
  }

  async current(userId: number): Promise<{ run: RiftView | null }> {
    const run = await this.getActiveRun(userId);
    if (!run) return { run: null };
    return { run: await this.buildView(userId, run.id) };
  }

  async move(userId: number, x: number, y: number): Promise<RiftMoveResult> {
    const run = await this.requireActiveRun(userId);
    await this.assertNoActiveBattle(userId);

    const distance = Math.abs(run.x - x) + Math.abs(run.y - y);
    if (distance !== 1) throw new BadRequestException('You can only move to an adjacent tile.');

    const tile = await this.prisma.riftTile.findUnique({
      where: { riftId_x_y: { riftId: run.riftId, x, y } },
      include: TILE_INCLUDE,
    });
    if (!tile) throw new BadRequestException('Solid rock blocks the way.');

    const events: string[] = [];
    let expGained = 0;
    let leveledUp = false;

    const alreadyExplored = await this.prisma.userExploredTile.findUnique({
      where: { userId_riftTileId: { userId, riftTileId: tile.id } },
    });

    await this.prisma.$transaction(async (tx) => {
      // Gates consume their item the first time this player passes through.
      if (!alreadyExplored && (tile.kind === RiftTileKind.LOCKED || tile.kind === RiftTileKind.DARK) && tile.requiredItem) {
        const owned = await tx.inventoryItem.findUnique({
          where: { userId_itemId: { userId, itemId: tile.requiredItem.id } },
        });
        if (!owned || owned.quantity < 1) {
          throw new ForbiddenException(tile.kind === RiftTileKind.LOCKED ? `The door is sealed. You need a ${tile.requiredItem.name}.` : `It is pitch black inside. You need a ${tile.requiredItem.name}.`);
        }
        if (owned.quantity > 1) {
          await tx.inventoryItem.update({ where: { id: owned.id }, data: { quantity: { decrement: 1 } } });
        } else {
          await tx.inventoryItem.delete({ where: { id: owned.id } });
        }
        events.push(`You used a ${tile.requiredItem.name} to open ${tile.name}.`);
      }

      await tx.riftRun.update({ where: { id: run.id }, data: { x, y } });

      if (!alreadyExplored) {
        await tx.userExploredTile.create({ data: { userId, riftTileId: tile.id } });

        // Exploration exp, deeper tiles are worth more.
        expGained = Math.round((GAME_CONFIG.rift.exploreExpBase + tile.depth) * run.rift.tier * GAME_CONFIG.rewards.expMultiplier);
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true, exp: true } });
        const { level, remainingExp } = calculateLevelUp(user.level, user.exp + expGained);
        leveledUp = level > user.level;
        await tx.user.update({
          where: { id: userId },
          data: {
            exp: remainingExp,
            level,
            statPoints: { increment: (level - user.level) * GAME_CONFIG.leveling.statPointsPerLevel },
            perkPoints: { increment: perkPointsForLevel(level) - perkPointsForLevel(user.level) },
          },
        });
        events.push(`You discover ${tile.name} (+${expGained} exp).`);
        if (leveledUp) events.push('Level up!');
      }
    });

    // Живой monster (or boss) on the tile → combat starts (fog reveal happened above).
    let battleStarted = false;
    if ((tile.kind === RiftTileKind.MONSTER || tile.kind === RiftTileKind.BOSS) && tile.monsterId && this.isTileActive(tile)) {
      await this.battleService.startRiftBattle(userId, tile.id);
      events.push(tile.kind === RiftTileKind.BOSS ? `${tile.monster!.name} rises to meet you!` : `A ${tile.monster!.name} lunges at you!`);
      battleStarted = true;
    }

    return {
      view: await this.buildView(userId, run.id),
      events,
      expGained,
      leveledUp,
      battleStarted,
    };
  }

  async gather(userId: number): Promise<RiftGatherResult> {
    const run = await this.requireActiveRun(userId);
    await this.assertNoActiveBattle(userId);

    const tile = await this.prisma.riftTile.findUnique({
      where: { riftId_x_y: { riftId: run.riftId, x: run.x, y: run.y } },
      include: TILE_INCLUDE,
    });
    const isChest = tile?.kind === RiftTileKind.CHEST;
    const isResource = tile?.kind === RiftTileKind.RESOURCE;
    if (!tile || (!isChest && !isResource) || !tile.resourceItem) {
      throw new BadRequestException('There is nothing to gather here.');
    }

    // Lazy respawn before attempting to take a charge. Chests never set
    // respawnAt, so this is a no-op for them — once opened, opened forever.
    if (tile.respawnAt && tile.respawnAt <= new Date()) {
      await this.prisma.riftTile.update({ where: { id: tile.id }, data: { charges: tile.maxCharges, respawnAt: null } });
      tile.charges = tile.maxCharges;
      tile.respawnAt = null;
    }

    // Shared, contested node: the decrement is atomic so two players can't
    // both take the last charge.
    const claimed = await this.prisma.riftTile.updateMany({
      where: { id: tile.id, charges: { gt: 0 }, respawnAt: null },
      data: { charges: { decrement: 1 } },
    });
    if (claimed.count === 0) {
      return {
        view: await this.buildView(userId, run.id),
        gathered: null,
        goldGained: 0,
        message: isChest ? 'This chest has already been emptied.' : 'The node is picked clean. Someone got here first.',
      };
    }

    const remaining = tile.charges - 1;
    if (isResource && remaining <= 0) {
      await this.prisma.riftTile.update({
        where: { id: tile.id },
        data: { respawnAt: new Date(Date.now() + GAME_CONFIG.rift.resourceRespawnMs) },
      });
    }

    const quantity = isChest ? 2 : 1;
    const gathered: RiftLootEntry = {
      itemId: tile.resourceItem.id,
      name: tile.resourceItem.name,
      rarity: tile.resourceItem.rarity,
      quantity,
    };
    const loot = addRiftLoot(parseRiftLoot(run.loot), [gathered]);

    // Chest gold is a straightforward reward, not at-risk loot — paid out
    // immediately, same as monster kill gold always has been.
    let goldGained = 0;
    if (isChest && tile.goldReward > 0) {
      goldGained = Math.round(tile.goldReward * GAME_CONFIG.rewards.goldMultiplier);
      await this.prisma.user.update({ where: { id: userId }, data: { gold: { increment: goldGained } } });
    }
    await this.prisma.riftRun.update({ where: { id: run.id }, data: { loot: loot as unknown as Prisma.InputJsonValue } });

    return {
      view: await this.buildView(userId, run.id),
      gathered,
      goldGained,
      message: isChest ? `You open the chest: ${gathered.name} x${quantity}${goldGained ? ` and ${goldGained} gold` : ''}!` : `You gather ${tile.resourceItem.name}. It goes into your rift bag.`,
    };
  }

  async extract(userId: number): Promise<RiftExtractResult> {
    const run = await this.requireActiveRun(userId);
    await this.assertNoActiveBattle(userId);

    const banked = parseRiftLoot(run.loot);
    await this.prisma.$transaction(async (tx) => {
      for (const entry of banked) {
        await grantItem(tx, userId, entry.itemId, entry.quantity);
      }
      await tx.riftRun.update({ where: { id: run.id }, data: { status: RiftRunStatus.EXTRACTED } });
    });

    return {
      banked,
      message: banked.length ? `You step out of the rift with ${banked.reduce((s, e) => s + e.quantity, 0)} items secured.` : 'You step out of the rift empty-handed.',
    };
  }

  // --- View building (fog of war) ---

  private async buildView(userId: number, runId: number): Promise<RiftView> {
    const run = await this.prisma.riftRun.findUniqueOrThrow({
      where: { id: runId },
      include: { rift: { include: { tiles: { include: TILE_INCLUDE } } } },
    });
    const explored = await this.prisma.userExploredTile.findMany({
      where: { userId, tile: { riftId: run.riftId } },
      select: { riftTileId: true },
    });
    const exploredIds = new Set(explored.map((e) => e.riftTileId));

    const byCoord = new Map(run.rift.tiles.map((t) => [`${t.x},${t.y}`, t]));
    const views = new Map<string, RiftTileView>();

    for (const tile of run.rift.tiles) {
      if (!exploredIds.has(tile.id)) continue;
      views.set(`${tile.x},${tile.y}`, this.exploredTileView(tile));

      // Frontier: neighbors of explored tiles appear as fog. Gates show their
      // nature (and required item) so the player knows what to hunt for.
      for (const [dx, dy] of DIRS) {
        const key = `${tile.x + dx},${tile.y + dy}`;
        const neighbor = byCoord.get(key);
        if (!neighbor || exploredIds.has(neighbor.id) || views.has(key)) continue;
        views.set(key, this.frontierTileView(neighbor));
      }
    }

    const keyItemNames = [TORCH_ITEM_NAME, RIFT_KEY_ITEM_NAME];
    const ownedKeyItems = await this.prisma.inventoryItem.findMany({
      where: { userId, item: { name: { in: keyItemNames } } },
      include: { item: true },
    });
    const ownedByName = new Map(ownedKeyItems.map((o) => [o.item.name, o.quantity]));

    return {
      id: run.rift.id,
      name: run.rift.name,
      tier: run.rift.tier,
      gridWidth: run.rift.gridWidth,
      gridHeight: run.rift.gridHeight,
      expiresAt: run.rift.expiresAt.toISOString(),
      position: { x: run.x, y: run.y },
      tiles: [...views.values()],
      lootBag: parseRiftLoot(run.loot),
      keyItems: keyItemNames.map((name) => ({ name, quantity: ownedByName.get(name) ?? 0 })),
    };
  }

  private exploredTileView(tile: TileWithRefs): RiftTileView {
    const active = this.isTileActive(tile);
    const isMonsterLike = tile.kind === RiftTileKind.MONSTER || tile.kind === RiftTileKind.BOSS;
    const isChargeBased = tile.kind === RiftTileKind.RESOURCE || tile.kind === RiftTileKind.CHEST;
    return {
      x: tile.x,
      y: tile.y,
      kind: tile.kind,
      explored: true,
      name: tile.name,
      depth: tile.depth,
      roomId: tile.roomId,
      requiredItemName: tile.requiredItem?.name,
      monsterName: tile.monster?.name,
      monsterAlive: isMonsterLike ? active : undefined,
      resourceItemName: tile.kind === RiftTileKind.RESOURCE ? tile.resourceItem?.name : undefined,
      resourceRarity: tile.kind === RiftTileKind.RESOURCE ? tile.resourceItem?.rarity : undefined,
      charges: isChargeBased ? (tile.respawnAt && tile.respawnAt <= new Date() ? tile.maxCharges : tile.charges) : undefined,
    };
  }

  private frontierTileView(tile: TileWithRefs): RiftTileView {
    if (tile.kind === RiftTileKind.LOCKED || tile.kind === RiftTileKind.DARK) {
      return { x: tile.x, y: tile.y, kind: tile.kind, explored: false, name: tile.name, requiredItemName: tile.requiredItem?.name };
    }
    return { x: tile.x, y: tile.y, kind: 'FOG', explored: false };
  }

  // A monster/resource tile is "active" when it has no pending respawn window.
  private isTileActive(tile: { respawnAt: Date | null }): boolean {
    return tile.respawnAt === null || tile.respawnAt <= new Date();
  }

  // --- Helpers ---

  private getActiveRun(userId: number) {
    return this.prisma.riftRun.findFirst({
      where: { userId, status: RiftRunStatus.ACTIVE },
      include: { rift: true },
    });
  }

  private async requireActiveRun(userId: number) {
    const run = await this.getActiveRun(userId);
    if (!run) throw new NotFoundException('You are not inside a rift.');
    return run;
  }

  private async assertNoActiveBattle(userId: number) {
    const battle = await this.prisma.battle.findFirst({ where: { userId, status: BattleStatus.ACTIVE }, select: { id: true } });
    if (battle) throw new ForbiddenException('Resolve your current battle first.');
  }
}
