import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattleStatus } from '../../prisma/generated/client/enums';
import type { CoreStat, EquipmentSlot, PerkView } from '@my/shared';
import { CORE_STATS } from './stats.constants';
import { CharacterStatsService, REGEN_INTERVAL_MS, STATS_INCLUDE } from './character-stats.service';
import { PERK_DEFINITIONS, PERK_BY_CODE } from './perks.config';

const RESURRECT_HP_PERCENT = 0.5;

type LoadedUser = NonNullable<Awaited<ReturnType<CharacterService['loadUser']>>>;

@Injectable()
export class CharacterService {
  constructor(
    private prisma: PrismaService,
    private stats: CharacterStatsService,
  ) {}

  private loadUser(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId }, include: STATS_INCLUDE });
  }

  async getMe(userId: number) {
    let user = await this.loadUser(userId);
    if (!user) throw new NotFoundException('User not found');

    user = await this.applyRegen(user);
    return this.buildView(user);
  }

  async allocateStat(userId: number, stat: CoreStat, points: number) {
    if (!CORE_STATS.includes(stat)) throw new BadRequestException('Unknown stat.');
    if (!Number.isInteger(points) || points < 1) throw new BadRequestException('Points must be a positive integer.');

    const user = await this.loadUser(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.statPoints < points) throw new BadRequestException('Not enough stat points.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { [stat]: { increment: points }, statPoints: { decrement: points } },
    });

    await this.syncMaxHp(userId);
    return this.getMe(userId);
  }

  listPerks(userId: number): Promise<PerkView[]> {
    return this.loadUser(userId).then((user) => {
      if (!user) throw new NotFoundException('User not found');
      const unlocked = new Set(user.perks.map((p) => p.perkCode));
      return PERK_DEFINITIONS.map((perk) => ({
        ...perk,
        unlocked: unlocked.has(perk.code),
        canUnlock: !unlocked.has(perk.code) && user.level >= perk.requiredLevel && user.perkPoints > 0,
      }));
    });
  }

  async unlockPerk(userId: number, code: string) {
    const perk = PERK_BY_CODE.get(code);
    if (!perk) throw new BadRequestException('Unknown perk.');

    const user = await this.loadUser(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.perks.some((p) => p.perkCode === code)) throw new BadRequestException('Perk already unlocked.');
    if (user.level < perk.requiredLevel) throw new BadRequestException(`Requires level ${perk.requiredLevel}.`);
    if (user.perkPoints < 1) throw new BadRequestException('No perk points available.');

    await this.prisma.$transaction([this.prisma.userPerk.create({ data: { userId, perkCode: code } }), this.prisma.user.update({ where: { id: userId }, data: { perkPoints: { decrement: 1 } } })]);

    await this.syncMaxHp(userId);
    return this.getMe(userId);
  }

  async resurrect(userId: number) {
    const user = await this.loadUser(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.isDead) throw new BadRequestException('Your character is not dead.');

    const maxHp = this.stats.computeProfile(user).combat.maxHp;
    const restoredHp = Math.max(1, Math.floor(maxHp * RESURRECT_HP_PERCENT));

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { hp: restoredHp, maxHp, isDead: false, hpUpdatedAt: new Date() },
      }),
      this.prisma.battle.updateMany({
        where: { userId, status: BattleStatus.ACTIVE },
        data: { status: BattleStatus.LOST },
      }),
    ]);

    return { message: 'You have been resurrected.', hp: restoredHp, maxHp };
  }

  // Recompute maxHp from current stats/equipment/perks and persist it, clamping
  // current HP so it never exceeds the new maximum. Called after anything that
  // can change strength (stat allocation, perks, equipment).
  async syncMaxHp(userId: number) {
    const user = await this.loadUser(userId);
    if (!user) return;
    const maxHp = this.stats.computeProfile(user).combat.maxHp;
    if (maxHp === user.maxHp && user.hp <= maxHp) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { maxHp, hp: Math.min(user.hp, maxHp) },
    });
  }

  // --- Helpers ---

  private async applyRegen(user: LoadedUser): Promise<LoadedUser> {
    const { combat } = this.stats.computeProfile(user);
    const maxHp = combat.maxHp;

    if (user.isDead || combat.healthRegenPerCycle <= 0) return user;

    // Keep maxHp in sync as a side effect (cheap and avoids stale caches).
    if (user.hp >= maxHp) {
      if (user.maxHp !== maxHp || user.hp > maxHp) {
        const clampedHp = Math.min(user.hp, maxHp);
        await this.prisma.user.update({ where: { id: user.id }, data: { maxHp, hp: clampedHp, hpUpdatedAt: new Date() } });
        return { ...user, maxHp, hp: clampedHp, hpUpdatedAt: new Date() };
      }
      return user;
    }

    const now = Date.now();
    const elapsed = now - user.hpUpdatedAt.getTime();
    const cycles = Math.floor(elapsed / REGEN_INTERVAL_MS);
    if (cycles <= 0) {
      if (user.maxHp !== maxHp) {
        await this.prisma.user.update({ where: { id: user.id }, data: { maxHp } });
        return { ...user, maxHp };
      }
      return user;
    }

    const regen = Math.floor(cycles * combat.healthRegenPerCycle);
    const newHp = Math.min(maxHp, user.hp + regen);
    const newAnchor = new Date(user.hpUpdatedAt.getTime() + cycles * REGEN_INTERVAL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { hp: newHp, maxHp, hpUpdatedAt: newAnchor },
    });
    return { ...user, hp: newHp, maxHp, hpUpdatedAt: newAnchor };
  }

  private buildView(user: LoadedUser) {
    const profile = this.stats.computeProfile(user);

    const equipment = {} as Record<EquipmentSlot, ReturnType<CharacterService['equippedView']> | null>;
    for (const slot of ['WEAPON', 'HELMET', 'BODY', 'PANTS', 'GLOVES'] as EquipmentSlot[]) equipment[slot] = null;
    for (const owned of user.ownedEquipment) {
      if (!owned.equipped) continue;
      equipment[owned.equipmentItem.slot as EquipmentSlot] = this.equippedView(owned);
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      level: user.level,
      exp: user.exp,
      expToNextLevel: user.level * 100,
      gold: user.gold,
      hp: user.hp,
      maxHp: profile.combat.maxHp,
      isDead: user.isDead,
      statPoints: user.statPoints,
      perkPoints: user.perkPoints,
      position: { locationId: user.currentLocationId, x: user.posX, y: user.posY },
      stats: profile.breakdown,
      combat: profile.combat,
      equipment,
      perks: user.perks.map((p) => p.perkCode),
      createdAt: user.createdAt,
    };
  }

  private equippedView(owned: LoadedUser['ownedEquipment'][number]) {
    const item = owned.equipmentItem;
    const modifiers: Partial<Record<CoreStat, number>> = {};
    for (const stat of CORE_STATS) {
      if (item[stat] !== 0) modifiers[stat] = item[stat];
    }
    return {
      ownedId: owned.id,
      itemId: item.id,
      name: item.name,
      slot: item.slot as EquipmentSlot,
      rarity: item.rarity,
      description: item.description,
      icon: item.icon,
      minLevel: item.minLevel,
      baseDamage: item.baseDamage,
      attackSpeed: item.attackSpeed,
      modifiers,
    };
  }
}
