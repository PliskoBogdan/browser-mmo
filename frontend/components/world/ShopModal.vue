<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="warning" class="mr-2">mdi-store</v-icon>
        {{ subLocation?.name }}
        <v-spacer />
        <v-chip size="small" color="warning" variant="tonal" prepend-icon="mdi-cash">{{ characterStore.character?.gold ?? 0 }}</v-chip>
      </v-card-title>
      <v-card-subtitle v-if="subLocation?.description">{{ subLocation.description }}</v-card-subtitle>

      <v-divider class="mt-2" />

      <v-card-text style="max-height: 360px; overflow-y: auto">
        <div v-if="inventoryStore.loading" class="d-flex justify-center py-6">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <v-alert v-else-if="!inventoryStore.items.length" type="info" variant="tonal" density="compact">
          Your pockets are empty. Go find some loot out there.
        </v-alert>
        <v-list v-else density="compact">
          <v-list-item v-for="entry in inventoryStore.items" :key="entry.itemId" :title="entry.name" :subtitle="entry.description ?? undefined">
            <template #prepend>
              <v-icon :color="rarityColor(entry.rarity)">mdi-cube-outline</v-icon>
            </template>
            <template #append>
              <div class="d-flex align-center" style="gap: 8px">
                <v-chip size="x-small" variant="tonal">x{{ entry.quantity }}</v-chip>
                <v-chip size="x-small" color="warning" variant="tonal">{{ entry.sellValue }}g ea</v-chip>
                <v-btn size="small" variant="tonal" color="primary" :loading="sellingId === entry.itemId" @click="handleSell(entry)">Sell all</v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-alert v-if="sellMessage" type="success" variant="tonal" density="compact" class="mx-4 mb-2" closable @click:close="sellMessage = ''">
        {{ sellMessage }}
      </v-alert>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { SubLocationCell } from '~/stores/world';
import type { InventoryEntry, ItemRarity } from '~/stores/inventory';

const props = defineProps<{
  modelValue: boolean;
  subLocation: SubLocationCell | null;
}>();

defineEmits<{ 'update:modelValue': [value: boolean] }>();

const inventoryStore = useInventoryStore();
const characterStore = useCharacterStore();

const sellingId = ref<number | null>(null);
const sellMessage = ref('');

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      sellMessage.value = '';
      inventoryStore.fetchInventory();
    }
  },
);

const rarityColors: Record<ItemRarity, string> = {
  COMMON: '#9e9e9e',
  UNCOMMON: '#4caf50',
  RARE: '#ffab00',
};

function rarityColor(rarity: ItemRarity) {
  return rarityColors[rarity];
}

async function handleSell(entry: InventoryEntry) {
  sellingId.value = entry.itemId;
  try {
    const result = await inventoryStore.sell(entry.itemId, entry.quantity);
    sellMessage.value = result.message;
    await characterStore.fetch();
  } finally {
    sellingId.value = null;
  }
}
</script>
