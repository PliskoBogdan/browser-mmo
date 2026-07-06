import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattleStatus, RiftRunStatus } from '../../prisma/generated/client/enums';
import { StaminaService } from '../character/stamina.service';
import { BattleService } from '../battle/battle.service';
import { GAME_CONFIG } from '../config/game.config';
import { AMBUSH_TABLE } from './camp.config';

export interface CampView {
  mapX: number;
  mapY: number;
  placedAt: string;
  expiresAt: string;
}

export interface CampStatus {
  camp: CampView | null;
  // Ms until a new camp can be placed (0 = ready now).
  cooldownRemainingMs: number;
}

export interface PlaceCampResult {
  placed: boolean;
  ambushed: boolean;
  message: string;
  monsterName?: string;
  camp: CampView | null;
  stamina: { stamina: number; maxStamina: number };
}

// A campfire is a persistent object on the player's world cell: while its
// owner stands on it, stamina regenerates (see StaminaService.reconcile) —
// step away and the regen stops, but the fire keeps burning until it expires,
// so the player can return to it. Placing one is cooldown-gated and risks a
// wilderness ambush that interrupts the setup.
@Injectable()
export class CampService {
  constructor(
    private prisma: PrismaService,
    private stamina: StaminaService,
    private battleService: BattleService,
  ) {}

  async getStatus(userId: number): Promise<CampStatus> {
    const camp = await this.getActiveCamp(userId);
    if (!camp) return { camp: null, cooldownRemainingMs: 0 };
    return {
      camp: this.view(camp),
      cooldownRemainingMs: Math.max(0, camp.placedAt.getTime() + GAME_CONFIG.stamina.campCooldownMs - Date.now()),
    };
  }

  async placeCamp(userId: number): Promise<PlaceCampResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, isDead: true, currentLocationId: true, posX: true, posY: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.isDead) throw new ForbiddenException('Your character is dead. Resurrect first.');
    if (user.currentLocationId !== null) {
      throw new BadRequestException('You can only make camp out on the world map — inside a location, rest at a safe spot instead.');
    }

    const [activeBattle, activeRun] = await Promise.all([this.prisma.battle.findFirst({ where: { userId, status: BattleStatus.ACTIVE }, select: { id: true } }), this.prisma.riftRun.findFirst({ where: { userId, status: RiftRunStatus.ACTIVE }, select: { id: true } })]);
    if (activeBattle) throw new ForbiddenException('Resolve your current battle first.');
    if (activeRun) throw new ForbiddenException('You are inside a rift. Extract from it first.');

    // No campfires on top of settlements or rifts — those cells have their own business.
    const [locationHere, riftHere] = await Promise.all([this.prisma.location.findUnique({ where: { mapX_mapY: { mapX: user.posX, mapY: user.posY } }, select: { id: true } }), this.prisma.rift.findFirst({ where: { mapX: user.posX, mapY: user.posY, expiresAt: { gt: new Date() } }, select: { id: true } })]);
    if (locationHere || riftHere) throw new BadRequestException("You can't camp here — the spot is already occupied. Move to an open cell.");

    const existing = await this.getActiveCamp(userId);
    const cooldownMs = existing ? existing.placedAt.getTime() + GAME_CONFIG.stamina.campCooldownMs - Date.now() : 0;
    if (cooldownMs > 0) {
      throw new BadRequestException(`You can set up a new camp in ${this.formatMs(cooldownMs)} — or return to your old fire meanwhile.`);
    }

    const staminaState = await this.stamina.getState(userId);

    // The setup can be interrupted: no fire placed, no cooldown consumed.
    if (Math.random() < GAME_CONFIG.stamina.campAmbushChance) {
      const monster = await this.pickAmbushMonster(user.level);
      await this.battleService.startAmbushBattle(userId, monster.id);
      return {
        placed: false,
        ambushed: true,
        monsterName: monster.name,
        message: `You barely light the fire when a ${monster.name} lunges out of the dark!`,
        camp: existing ? this.view(existing) : null,
        stamina: staminaState,
      };
    }

    const now = new Date();
    const data = { mapX: user.posX, mapY: user.posY, placedAt: now, expiresAt: new Date(now.getTime() + GAME_CONFIG.stamina.campLifetimeMs) };
    const camp = await this.prisma.camp.upsert({ where: { userId }, update: data, create: { userId, ...data } });
    // Rest time counts from this moment — stale pre-camp time must not regen.
    await this.stamina.reanchor(userId);

    return {
      placed: true,
      ambushed: false,
      message: 'You set up camp. Stay by the fire and your strength returns.',
      camp: this.view(camp),
      stamina: staminaState,
    };
  }

  // --- Helpers ---

  // The player's camp, with expired fires cleaned up lazily on read.
  private async getActiveCamp(userId: number) {
    const camp = await this.prisma.camp.findUnique({ where: { userId } });
    if (!camp) return null;
    if (camp.expiresAt.getTime() <= Date.now()) {
      await this.prisma.camp.delete({ where: { userId } });
      return null;
    }
    return camp;
  }

  private view(camp: { mapX: number; mapY: number; placedAt: Date; expiresAt: Date }): CampView {
    return { mapX: camp.mapX, mapY: camp.mapY, placedAt: camp.placedAt.toISOString(), expiresAt: camp.expiresAt.toISOString() };
  }

  private formatMs(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  private async pickAmbushMonster(level: number) {
    const entry = AMBUSH_TABLE.find((e) => level >= e.minLevel) ?? AMBUSH_TABLE[AMBUSH_TABLE.length - 1];
    const monster = await this.prisma.monster.findFirst({ where: { name: entry.monsterName } });
    if (!monster) throw new NotFoundException(`Ambush monster "${entry.monsterName}" is missing — run the seed first.`);
    return monster;
  }
}
