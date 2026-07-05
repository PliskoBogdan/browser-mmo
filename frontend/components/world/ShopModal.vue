<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :color="isLootShop ? 'deep-purple' : 'warning'" class="mr-2">{{ isLootShop ? 'mdi-treasure-chest' : 'mdi-store' }}</v-icon>
        {{ subLocation?.name }}
        <v-spacer />
        <v-chip size="small" color="warning" variant="tonal" prepend-icon="mdi-cash">{{ characterStore.character?.gold ?? 0 }}</v-chip>
      </v-card-title>
      <v-card-subtitle v-if="subLocation?.description">{{ subLocation.description }}</v-card-subtitle>
      <v-chip size="x-small" variant="text" class="mx-4 mb-2" :color="isLootShop ? 'deep-purple' : 'warning'">
        {{ isLootShop ? 'Buys loot for gold — no weapons or armor here.' : 'Sells weapons & armor — this trader doesn\'t buy loot.' }}
      </v-chip>

      <v-divider />

      <v-card-text style="max-height: 420px; overflow-y: auto">
        <!-- Weapon/armor shop: buy only -->
        <template v-if="isWeaponShop">
          <div v-if="shopStore.loading" class="d-flex justify-center py-6">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <v-alert v-else-if="!shopStore.catalog.length" type="info" variant="tonal" density="compact">
            Nothing for sale here right now.
          </v-alert>
          <v-list v-else density="compact">
            <v-list-item v-for="entry in shopStore.catalog" :key="entry.itemId" :title="entry.name" :subtitle="entry.description ?? undefined">
              <template #prepend>
                <v-icon :color="rarityColor(entry.rarity)">{{ entry.icon ?? slotIcon(entry.slot) }}</v-icon>
              </template>
              <template #append>
                <div class="d-flex flex-column align-end" style="gap: 4px">
                  <div class="d-flex align-center" style="gap: 6px">
                    <v-chip v-if="entry.baseDamage" size="x-small" color="error" variant="tonal">{{ entry.baseDamage }} dmg</v-chip>
                    <v-chip
                      v-for="(val, key) in entry.modifiers"
                      :key="key"
                      size="x-small"
                      variant="tonal"
                      :color="(val ?? 0) > 0 ? 'success' : 'error'"
                    >
                      {{ (val ?? 0) > 0 ? '+' : '' }}{{ val }} {{ key }}
                    </v-chip>
                  </div>
                  <div class="d-flex align-center" style="gap: 8px">
                    <v-chip v-if="!entry.meetsLevel" size="x-small" color="error" variant="tonal">Requires Lv {{ entry.minLevel }}</v-chip>
                    <v-chip size="x-small" color="warning" variant="tonal">{{ entry.price }}g</v-chip>
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      :disabled="!entry.canAfford || buyingId === entry.itemId"
                      :loading="buyingId === entry.itemId"
                      @click="handleBuy(entry)"
                    >
                      Buy
                    </v-btn>
                  </div>
                </div>
              </template>
            </v-list-item>
          </v-list>

          <template v-if="shopStore.consumables.length">
            <v-divider class="my-2" />
            <div class="text-overline text-medium-emphasis px-2">Tools</div>
            <v-list density="compact">
              <v-list-item v-for="entry in shopStore.consumables" :key="entry.itemId" :title="entry.name" :subtitle="entry.description ?? undefined">
                <template #prepend>
                  <v-icon :color="rarityColor(entry.rarity)">mdi-torch</v-icon>
                </template>
                <template #append>
                  <div class="d-flex align-center" style="gap: 8px">
                    <v-chip size="x-small" color="warning" variant="tonal">{{ entry.price }}g</v-chip>
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      :disabled="!entry.canAfford || buyingItemId === entry.itemId"
                      :loading="buyingItemId === entry.itemId"
                      @click="handleBuyItem(entry)"
                    >
                      Buy
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </template>
        </template>

        <!-- Loot buyer: sell only -->
        <template v-else-if="isLootShop">
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
        </template>
      </v-card-text>

      <v-alert v-if="message" :type="messageType" variant="tonal" density="compact" class="mx-4 mb-2" closable @click:close="message = ''">
        {{ message }}
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
import type { InventoryEntry, ItemRarity as LootRarity } from '~/stores/inventory';
import type { ShopCatalogEntry, ShopConsumableEntry } from '~/stores/shop';
import type { EquipmentSlot, ItemRarity } from '~/stores/character';

const props = defineProps<{
  modelValue: boolean;
  subLocation: SubLocationCell | null;
}>();

defineEmits<{ 'update:modelValue': [value: boolean] }>();

const inventoryStore = useInventoryStore();
const characterStore = useCharacterStore();
const shopStore = useShopStore();

const sellingId = ref<number | null>(null);
const buyingId = ref<number | null>(null);
const buyingItemId = ref<number | null>(null);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

const isWeaponShop = computed(() => props.subLocation?.kind === 'SHOP');
const isLootShop = computed(() => props.subLocation?.kind === 'LOOT_SHOP');

watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.subLocation) return;
    message.value = '';
    if (isWeaponShop.value) shopStore.fetchCatalog(props.subLocation.id);
    else if (isLootShop.value) inventoryStore.fetchInventory();
  },
);

const rarityColors: Record<ItemRarity | LootRarity, string> = {
  COMMON: '#9e9e9e',
  UNCOMMON: '#4caf50',
  RARE: '#ffab00',
};

function rarityColor(rarity: ItemRarity | LootRarity) {
  return rarityColors[rarity];
}

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  WEAPON: 'mdi-sword',
  HELMET: 'mdi-hard-hat',
  BODY: 'mdi-tshirt-crew',
  PANTS: 'mdi-human-handsdown',
  GLOVES: 'mdi-hand-back-right',
};

function slotIcon(slot: EquipmentSlot) {
  return SLOT_ICONS[slot];
}

async function handleBuy(entry: ShopCatalogEntry) {
  if (!props.subLocation) return;
  buyingId.value = entry.itemId;
  try {
    await shopStore.buy(props.subLocation.id, entry.itemId);
    message.value = `Bought ${entry.name}.`;
    messageType.value = 'success';
  } catch (e: any) {
    message.value = e?.data?.message ?? 'Could not buy that item.';
    messageType.value = 'error';
  } finally {
    buyingId.value = null;
  }
}

async function handleBuyItem(entry: ShopConsumableEntry) {
  if (!props.subLocation) return;
  buyingItemId.value = entry.itemId;
  try {
    await shopStore.buyItem(props.subLocation.id, entry.itemId);
    message.value = `Bought ${entry.name}.`;
    messageType.value = 'success';
  } catch (e: any) {
    message.value = e?.data?.message ?? 'Could not buy that item.';
    messageType.value = 'error';
  } finally {
    buyingItemId.value = null;
  }
}

async function handleSell(entry: InventoryEntry) {
  sellingId.value = entry.itemId;
  try {
    const result = await inventoryStore.sell(entry.itemId, entry.quantity);
    message.value = result.message;
    messageType.value = 'success';
    await characterStore.fetch();
  } catch (e: any) {
    message.value = e?.data?.message ?? 'Could not sell that.';
    messageType.value = 'error';
  } finally {
    sellingId.value = null;
  }
}
</script>
