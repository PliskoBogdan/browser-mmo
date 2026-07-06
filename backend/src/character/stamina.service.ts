import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterStatsService, STATS_INCLUDE } from './character-stats.service';
import { GAME_CONFIG } from '../config/game.config';

export interface StaminaState {
  stamina: number;
  maxStamina: number;
}

// Travel stamina, reconciled lazily on read (same anchor pattern as HP
// regen), but regen only ticks while the owner is standing on their own
// campfire cell — there is no passive trickle out in the open. Every
// mutation re-anchors staminaUpdatedAt, and so does placing a camp, so time
// spent away from the fire is never credited: any path back onto the camp
// cell goes through a move (spend → re-anchor) or a fresh placement.
// Max stamina is derived from endurance and never stored.
@Injectable()
export class StaminaService {
  constructor(
    private prisma: PrismaService,
    private stats: CharacterStatsService,
  ) {}

  // Applies pending trickle regen (and clamps to the current max, which may
  // have changed with gear/perks) before returning the state.
  async getState(userId: number): Promise<StaminaState> {
    const user = await this.loadUser(userId);
    return this.reconcile(user);
  }

  // Spends stamina for an action, or throws if there isn't enough.
  async spend(userId: number, amount: number, actionLabel: string): Promise<StaminaState> {
    const user = await this.loadUser(userId);
    const { stamina, maxStamina } = await this.reconcile(user);
    if (stamina < amount) {
      throw new BadRequestException(`Not enough stamina to ${actionLabel} (${stamina}/${amount} needed). Camp, rest at a safe spot, or eat something.`);
    }
    return this.write(userId, stamina - amount, maxStamina);
  }

  // Adds stamina (food, camping), clamped to max.
  async restore(userId: number, amount: number): Promise<StaminaState> {
    const user = await this.loadUser(userId);
    const { stamina, maxStamina } = await this.reconcile(user);
    return this.write(userId, Math.min(maxStamina, stamina + amount), maxStamina);
  }

  async restoreFull(userId: number): Promise<StaminaState> {
    const user = await this.loadUser(userId);
    const { maxStamina } = await this.reconcile(user);
    return this.write(userId, maxStamina, maxStamina);
  }

  // --- Helpers ---

  private async loadUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { ...STATS_INCLUDE, camp: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async reconcile(
    user: {
      id: number;
      stamina: number;
      staminaUpdatedAt: Date;
      currentLocationId: number | null;
      posX: number;
      posY: number;
      camp: { mapX: number; mapY: number; expiresAt: Date } | null;
    } & Parameters<CharacterStatsService['computeProfile']>[0],
  ): Promise<StaminaState> {
    const cfg = GAME_CONFIG.stamina;
    const maxStamina = this.stats.computeProfile(user).combat.maxStamina;

    if (user.stamina >= maxStamina) {
      // May exceed max after an endurance-gear swap — clamp, don't regen.
      if (user.stamina > maxStamina) {
        await this.prisma.user.update({ where: { id: user.id }, data: { stamina: maxStamina, staminaUpdatedAt: new Date() } });
      }
      return { stamina: Math.min(user.stamina, maxStamina), maxStamina };
    }

    // Regen only ticks by the fire: the player must be out on the world map,
    // standing exactly on their own still-burning camp.
    const camp = user.camp;
    const now = Date.now();
    const onOwnCamp = camp !== null && camp.expiresAt.getTime() > now && user.currentLocationId === null && user.posX === camp.mapX && user.posY === camp.mapY;
    if (!onOwnCamp) return { stamina: user.stamina, maxStamina };

    // Never credit cycles from after the fire burns out.
    const regenUntil = Math.min(now, camp.expiresAt.getTime());
    const cycles = Math.floor((regenUntil - user.staminaUpdatedAt.getTime()) / cfg.campRegenIntervalMs);
    if (cycles <= 0) return { stamina: user.stamina, maxStamina };

    const stamina = Math.min(maxStamina, user.stamina + cycles * cfg.campRegenPerCycle);
    // Advance the anchor by whole elapsed cycles so partial progress carries over.
    const anchor = new Date(user.staminaUpdatedAt.getTime() + cycles * cfg.campRegenIntervalMs);
    await this.prisma.user.update({ where: { id: user.id }, data: { stamina, staminaUpdatedAt: anchor } });
    return { stamina, maxStamina };
  }

  // Called when a camp is placed: from this instant, time on the cell counts
  // as rest — stale pre-camp time must not be credited.
  async reanchor(userId: number): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { staminaUpdatedAt: new Date() } });
  }

  private async write(userId: number, stamina: number, maxStamina: number): Promise<StaminaState> {
    await this.prisma.user.update({ where: { id: userId }, data: { stamina, staminaUpdatedAt: new Date() } });
    return { stamina, maxStamina };
  }
}
