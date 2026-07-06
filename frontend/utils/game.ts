// Shared game-UI constants (auto-imported by Nuxt from utils/): rarity colors
// and equipment-slot icons, previously copy-pasted per component.

import type { EquipmentSlot, ItemRarity } from '~/stores/character';

export const RARITY_COLORS: Record<ItemRarity, string> = {
  COMMON: '#9e9e9e',
  UNCOMMON: '#4caf50',
  RARE: '#ffab00',
};

// Loose signature on purpose: some views carry rarity as a plain string
// (e.g. rift loot entries), so unknown values fall back to the COMMON color.
export function rarityColor(rarity: string): string {
  return RARITY_COLORS[rarity as ItemRarity] ?? RARITY_COLORS.COMMON;
}

export const SLOT_ICONS: Record<EquipmentSlot, string> = {
  WEAPON: 'mdi-sword',
  HELMET: 'mdi-hard-hat',
  BODY: 'mdi-tshirt-crew',
  PANTS: 'mdi-human-handsdown',
  GLOVES: 'mdi-hand-back-right',
};

export function slotIcon(slot: EquipmentSlot): string {
  return SLOT_ICONS[slot];
}
