import type { EquipmentSlot } from '~/stores/character';

export type DraggedGearSource = 'bag' | 'slot';

export interface DraggedGear {
  ownedId: number;
  slot: EquipmentSlot;
  source: DraggedGearSource;
}

// Shared UI state so the always-available InventoryWindow (drag source/drop
// target for unequip) and the character page's equipment slots (drop target
// for equip) can coordinate a drag that spans both components.
export const useUiStore = defineStore('ui', () => {
  const inventoryOpen = ref(false);
  const draggedGear = ref<DraggedGear | null>(null);

  function toggleInventory() {
    inventoryOpen.value = !inventoryOpen.value;
  }

  function startDrag(item: DraggedGear) {
    draggedGear.value = item;
  }

  function endDrag() {
    draggedGear.value = null;
  }

  return { inventoryOpen, draggedGear, toggleInventory, startDrag, endDrag };
});
