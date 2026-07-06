import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CoreStat, CraftIngredientView, CraftOutcome, CraftRecipeView, CraftResultView, EquipmentSlot, ItemRarity } from '@my/shared';
import { CORE_STATS } from '../character/stats.constants';
import { assertStandingAt } from '../location/sub-location-presence';
import { grantItem } from '../inventory/inventory.util';

// Same physical-presence rule as shops: the player must be standing on the
// forge's tile to browse or craft.
const FORGE_PRESENCE = { wrongKind: 'There is no forge here.', notPresent: 'You must be at this forge to do that.' };

@Injectable()
export class CraftingService {
  constructor(private prisma: PrismaService) {}

  async listForForge(userId: number, subLocationId: number): Promise<CraftRecipeView[]> {
    const [user, subLocation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, level: true, currentLocationId: true, posX: true, posY: true } }),
      this.prisma.subLocation.findUnique({
        where: { id: subLocationId },
        include: {
          forgeListings: {
            include: {
              recipe: {
                include: {
                  resultEquipment: true,
                  resultItem: true,
                  ingredients: { include: { item: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    assertStandingAt(user, subLocation, 'FORGE', FORGE_PRESENCE);

    const inventory = await this.prisma.inventoryItem.findMany({ where: { userId }, select: { itemId: true, quantity: true } });
    const ownedByItemId = new Map(inventory.map((entry) => [entry.itemId, entry.quantity]));

    return subLocation.forgeListings
      .map(({ recipe }) => {
        const ingredients: CraftIngredientView[] = recipe.ingredients.map((ing) => ({
          itemId: ing.itemId,
          name: ing.item.name,
          rarity: ing.item.rarity as ItemRarity,
          required: ing.quantity,
          owned: ownedByItemId.get(ing.itemId) ?? 0,
        }));

        const meetsLevel = user.level >= recipe.minLevel;
        const canAfford = user.gold >= recipe.goldCost;
        const hasMaterials = ingredients.every((ing) => ing.owned >= ing.required);

        return {
          recipeId: recipe.id,
          name: recipe.name,
          description: recipe.description,
          goldCost: recipe.goldCost,
          minLevel: recipe.minLevel,
          result: this.buildResultView(recipe),
          ingredients,
          meetsLevel,
          canAfford,
          hasMaterials,
          canCraft: meetsLevel && canAfford && hasMaterials,
        };
      })
      .sort((a, b) => a.minLevel - b.minLevel || a.recipeId - b.recipeId);
  }

  async craft(userId: number, subLocationId: number, recipeId: number): Promise<CraftOutcome> {
    const [user, subLocation] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId }, select: { gold: true, level: true, currentLocationId: true, posX: true, posY: true } }), this.prisma.subLocation.findUnique({ where: { id: subLocationId } })]);
    if (!user) throw new NotFoundException('User not found');
    if (!subLocation) throw new NotFoundException(`SubLocation #${subLocationId} not found`);
    assertStandingAt(user, subLocation, 'FORGE', FORGE_PRESENCE);

    const listing = await this.prisma.forgeListing.findUnique({
      where: { subLocationId_recipeId: { subLocationId, recipeId } },
      include: {
        recipe: {
          include: { resultEquipment: true, resultItem: true, ingredients: { include: { item: true } } },
        },
      },
    });
    if (!listing) throw new NotFoundException('This forge does not know that recipe.');

    const recipe = listing.recipe;
    if (user.level < recipe.minLevel) throw new ForbiddenException(`This recipe requires level ${recipe.minLevel}.`);
    if (user.gold < recipe.goldCost) throw new BadRequestException('Not enough gold.');

    const inventory = await this.prisma.inventoryItem.findMany({
      where: { userId, itemId: { in: recipe.ingredients.map((ing) => ing.itemId) } },
    });
    const heldByItemId = new Map(inventory.map((entry) => [entry.itemId, entry]));

    for (const ing of recipe.ingredients) {
      const held = heldByItemId.get(ing.itemId)?.quantity ?? 0;
      if (held < ing.quantity) {
        throw new BadRequestException(`Missing materials: need ${ing.quantity}x ${ing.item.name}, you have ${held}.`);
      }
    }

    // Consume gold + materials and grant the result atomically — a failed
    // grant must never leave the materials already burned.
    const operations = [
      this.prisma.user.update({ where: { id: userId }, data: { gold: { decrement: recipe.goldCost } } }),
      ...recipe.ingredients.map((ing) => {
        const held = heldByItemId.get(ing.itemId)!;
        return held.quantity > ing.quantity ? this.prisma.inventoryItem.update({ where: { id: held.id }, data: { quantity: { decrement: ing.quantity } } }) : this.prisma.inventoryItem.delete({ where: { id: held.id } });
      }),
      recipe.resultEquipment ? this.prisma.userEquipment.create({ data: { userId, equipmentItemId: recipe.resultEquipment.id, equipped: false } }) : grantItem(this.prisma, userId, recipe.resultItemId!, recipe.resultQuantity),
    ];
    await this.prisma.$transaction(operations);

    const resultName = recipe.resultEquipment?.name ?? recipe.resultItem?.name ?? recipe.name;
    const quantityNote = recipe.resultEquipment ? '' : ` x${recipe.resultQuantity}`;
    return {
      message: `Forged ${resultName}${quantityNote}.`,
      recipeId: recipe.id,
      gold: user.gold - recipe.goldCost,
    };
  }

  private buildResultView(recipe: {
    resultQuantity: number;
    resultEquipment: ({ name: string; slot: string; rarity: string; description: string | null; icon: string | null; baseDamage: number; attackSpeed: number | null; minLevel: number } & Record<CoreStat, number>) | null;
    resultItem: { name: string; rarity: string; description: string | null } | null;
  }): CraftResultView {
    const equipment = recipe.resultEquipment;
    if (equipment) {
      const modifiers: Partial<Record<CoreStat, number>> = {};
      for (const stat of CORE_STATS) {
        if (equipment[stat] !== 0) modifiers[stat] = equipment[stat];
      }
      return {
        kind: 'EQUIPMENT',
        name: equipment.name,
        rarity: equipment.rarity as ItemRarity,
        description: equipment.description,
        quantity: 1,
        slot: equipment.slot as EquipmentSlot,
        icon: equipment.icon,
        baseDamage: equipment.baseDamage,
        attackSpeed: equipment.attackSpeed,
        modifiers,
        equipMinLevel: equipment.minLevel,
      };
    }
    const item = recipe.resultItem!;
    return {
      kind: 'ITEM',
      name: item.name,
      rarity: item.rarity as ItemRarity,
      description: item.description,
      quantity: recipe.resultQuantity,
    };
  }
}
