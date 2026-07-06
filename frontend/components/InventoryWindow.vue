<template>
  <div>
    <v-btn
      icon
      color="primary"
      size="large"
      class="inv-fab"
      @click="uiStore.toggleInventory()"
    >
      <v-badge v-if="totalCount > 0" :content="totalCount" color="warning" floating>
        <v-icon>mdi-bag-personal</v-icon>
      </v-badge>
      <v-icon v-else>mdi-bag-personal</v-icon>
    </v-btn>

    <v-card
      v-if="uiStore.inventoryOpen"
      class="inv-window"
      elevation="12"
      :style="windowStyle"
    >
      <div class="inv-header" @mousedown="onHeaderMouseDown">
        <v-icon size="18" class="mr-2">mdi-drag</v-icon>
        <span class="font-weight-bold">Inventory</span>
        <v-spacer />
        <v-btn icon size="x-small" variant="text" @click="uiStore.inventoryOpen = false">
          <v-icon size="18">mdi-close</v-icon>
        </v-btn>
      </div>

      <v-divider />

      <div class="inv-body" @dragover.prevent="onBodyDragOver" @drop="onBodyDrop">
        <div class="text-overline text-medium-emphasis px-3 pt-2">Gear</div>
        <v-alert v-if="!unequippedGear.length" type="info" variant="tonal" density="compact" class="mx-3 mb-2">
          No unequipped gear. Buy or find some out there.
        </v-alert>
        <v-list v-else density="compact">
          <v-list-item
            v-for="g in unequippedGear"
            :key="g.ownedId"
            draggable="true"
            class="gear-row"
            @dragstart="onDragStart($event, g)"
            @dragend="uiStore.endDrag()"
          >
            <template #prepend>
              <v-icon :color="rarityColor(g.rarity)">{{ g.icon ?? SLOT_ICONS[g.slot] }}</v-icon>
            </template>
            <v-list-item-title class="text-body-2">{{ g.name }}</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip size="x-small" variant="outlined" class="mr-1">{{ g.slot }}</v-chip>
              <v-chip v-if="g.baseDamage" size="x-small" color="error" variant="tonal">{{ g.baseDamage }} dmg</v-chip>
            </v-list-item-subtitle>
            <template #append>
              <v-chip v-if="character && character.level < g.minLevel" size="x-small" color="error" variant="tonal">Lv {{ g.minLevel }}</v-chip>
              <v-btn
                v-else
                size="x-small"
                color="primary"
                variant="tonal"
                :disabled="busy"
                @click="run(() => characterStore.equip(g.ownedId))"
              >
                Equip
              </v-btn>
            </template>
          </v-list-item>
        </v-list>

        <v-divider class="my-2" />

        <div class="text-overline text-medium-emphasis px-3">Loot</div>
        <v-alert v-if="!inventoryStore.items.length" type="info" variant="tonal" density="compact" class="mx-3 mb-2">
          Nothing yet — sell loot at a Trading Post.
        </v-alert>
        <v-list v-else density="compact">
          <v-list-item v-for="entry in inventoryStore.items" :key="entry.itemId">
            <template #prepend>
              <v-icon :color="rarityColor(entry.rarity)">{{ entry.staminaRestore !== null ? 'mdi-food-drumstick' : 'mdi-cube-outline' }}</v-icon>
            </template>
            <v-list-item-title class="text-body-2">{{ entry.name }}</v-list-item-title>
            <template #append>
              <v-chip size="x-small" variant="tonal" class="mr-1">x{{ entry.quantity }}</v-chip>
              <v-chip size="x-small" color="warning" variant="tonal">{{ entry.sellValue }}g</v-chip>
              <v-btn
                v-if="entry.staminaRestore !== null"
                size="x-small"
                color="green"
                variant="tonal"
                class="ml-1"
                :disabled="busy"
                @click="run(() => inventoryStore.use(entry.itemId))"
              >
                Eat +{{ entry.staminaRestore }}
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { rarityColor, SLOT_ICONS } from '~/utils/game';

const characterStore = useCharacterStore();
const inventoryStore = useInventoryStore();
const uiStore = useUiStore();

const { character } = storeToRefs(characterStore);

const busy = ref(false);

const unequippedGear = computed(() => characterStore.gear.filter((g) => !g.equipped));
const totalCount = computed(() => unequippedGear.value.length + inventoryStore.items.length);

function refresh() {
  characterStore.fetchGear();
  inventoryStore.fetchInventory();
}

onMounted(refresh);
watch(() => uiStore.inventoryOpen, (open) => open && refresh());

async function run(action: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await action();
  } finally {
    busy.value = false;
  }
}

function onDragStart(event: DragEvent, g: { ownedId: number; slot: EquipmentSlot }) {
  uiStore.startDrag({ ownedId: g.ownedId, slot: g.slot, source: 'bag' });
  event.dataTransfer?.setData('text/plain', String(g.ownedId));
}

function onBodyDragOver() {
  // Only equipped items (dragged out of a slot) are valid drops here.
}

function onBodyDrop() {
  const dragged = uiStore.draggedGear;
  uiStore.endDrag();
  if (!dragged || dragged.source !== 'slot' || busy.value) return;
  run(() => characterStore.unequip(dragged.slot));
}

// --- Window drag-to-move ---
const hasMoved = ref(false);
const pos = ref({ x: 0, y: 0 });

function onHeaderMouseDown(event: MouseEvent) {
  const windowEl = (event.currentTarget as HTMLElement).closest('.inv-window') as HTMLElement | null;
  if (!windowEl) return;
  const rect = windowEl.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  if (!hasMoved.value) pos.value = { x: rect.left, y: rect.top };
  hasMoved.value = true;

  function onMove(e: MouseEvent) {
    pos.value = {
      x: Math.min(Math.max(0, e.clientX - offsetX), window.innerWidth - 40),
      y: Math.min(Math.max(0, e.clientY - offsetY), window.innerHeight - 40),
    };
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

const windowStyle = computed(() => (hasMoved.value ? { left: `${pos.value.x}px`, top: `${pos.value.y}px`, right: 'auto' } : {}));
</script>

<style scoped>
.inv-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2300;
}

.inv-window {
  position: fixed;
  right: 24px;
  top: 96px;
  width: 360px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  z-index: 2400;
}

.inv-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: move;
  user-select: none;
}

.inv-body {
  overflow-y: auto;
  flex: 1;
}

.gear-row[draggable='true'] {
  cursor: grab;
}
</style>
