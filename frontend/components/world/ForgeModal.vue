<template>
  <v-dialog :model-value="modelValue" max-width="640" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="deep-orange" class="mr-2">mdi-anvil</v-icon>
        {{ subLocation?.name }}
        <v-spacer />
        <v-chip size="small" color="warning" variant="tonal" prepend-icon="mdi-cash">{{ characterStore.character?.gold ?? 0 }}</v-chip>
      </v-card-title>
      <v-card-subtitle v-if="subLocation?.description">{{ subLocation.description }}</v-card-subtitle>
      <v-chip size="x-small" variant="text" class="mx-4 mb-2" color="deep-orange">
        Forges gear from materials found out in the world — loot, pelts, ore and trophies.
      </v-chip>

      <v-divider />

      <v-card-text style="max-height: 480px; overflow-y: auto">
        <div v-if="craftingStore.loading" class="d-flex justify-center py-6">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <v-alert v-else-if="!craftingStore.recipes.length" type="info" variant="tonal" density="compact">
          The smith has nothing to teach here.
        </v-alert>
        <v-expansion-panels v-else variant="accordion" multiple>
          <v-expansion-panel v-for="recipe in craftingStore.recipes" :key="recipe.recipeId">
            <v-expansion-panel-title>
              <div class="d-flex align-center flex-grow-1" style="gap: 8px; min-width: 0">
                <v-icon :color="rarityColor(recipe.result.rarity)" size="small">{{ resultIcon(recipe.result) }}</v-icon>
                <span class="text-truncate font-weight-medium">{{ recipe.name }}</span>
                <v-chip v-if="recipe.result.kind === 'ITEM'" size="x-small" variant="tonal">x{{ recipe.result.quantity }}</v-chip>
                <v-spacer />
                <v-chip v-if="!recipe.meetsLevel" size="x-small" color="error" variant="tonal" class="mr-1">Lv {{ recipe.minLevel }}</v-chip>
                <v-icon v-else-if="recipe.canCraft" color="success" size="small" class="mr-1">mdi-check-circle</v-icon>
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div v-if="recipe.description" class="text-body-2 text-medium-emphasis mb-2">{{ recipe.description }}</div>

              <!-- Result stats (gear only) -->
              <div v-if="recipe.result.kind === 'EQUIPMENT'" class="d-flex align-center flex-wrap mb-3" style="gap: 6px">
                <v-chip size="x-small" variant="tonal">{{ recipe.result.slot }}</v-chip>
                <v-chip v-if="recipe.result.baseDamage" size="x-small" color="error" variant="tonal">{{ recipe.result.baseDamage }} dmg</v-chip>
                <v-chip v-if="recipe.result.attackSpeed" size="x-small" variant="tonal">{{ recipe.result.attackSpeed }} spd</v-chip>
                <v-chip
                  v-for="(val, key) in recipe.result.modifiers"
                  :key="key"
                  size="x-small"
                  variant="tonal"
                  :color="(val ?? 0) > 0 ? 'success' : 'error'"
                >
                  {{ (val ?? 0) > 0 ? '+' : '' }}{{ val }} {{ key }}
                </v-chip>
              </div>

              <!-- Ingredients: have/need -->
              <div class="text-overline text-medium-emphasis">Materials</div>
              <div class="d-flex flex-column mb-3" style="gap: 4px">
                <div v-for="ing in recipe.ingredients" :key="ing.itemId" class="d-flex align-center" style="gap: 8px">
                  <v-icon size="x-small" :color="rarityColor(ing.rarity)">mdi-cube-outline</v-icon>
                  <span class="text-body-2">{{ ing.name }}</span>
                  <v-spacer />
                  <span class="text-body-2" :class="ing.owned >= ing.required ? 'text-success' : 'text-error'">
                    {{ ing.owned }} / {{ ing.required }}
                  </span>
                </div>
              </div>

              <div class="d-flex align-center" style="gap: 8px">
                <v-chip size="x-small" color="warning" variant="tonal">{{ recipe.goldCost }}g</v-chip>
                <v-chip v-if="!recipe.meetsLevel" size="x-small" color="error" variant="tonal">Requires Lv {{ recipe.minLevel }}</v-chip>
                <v-spacer />
                <v-btn
                  size="small"
                  variant="tonal"
                  color="deep-orange"
                  prepend-icon="mdi-hammer"
                  :disabled="!recipe.canCraft || craftingId !== null"
                  :loading="craftingId === recipe.recipeId"
                  @click="handleCraft(recipe)"
                >
                  Forge
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
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
import type { CraftRecipeView, CraftResultView } from '~/stores/crafting';
import type { EquipmentSlot, ItemRarity } from '~/stores/character';

const props = defineProps<{
  modelValue: boolean;
  subLocation: SubLocationCell | null;
}>();

defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();
const craftingStore = useCraftingStore();

const craftingId = ref<number | null>(null);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.subLocation) return;
    message.value = '';
    craftingStore.fetchRecipes(props.subLocation.id);
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

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  WEAPON: 'mdi-sword',
  HELMET: 'mdi-hard-hat',
  BODY: 'mdi-tshirt-crew',
  PANTS: 'mdi-human-handsdown',
  GLOVES: 'mdi-hand-back-right',
};

function resultIcon(result: CraftResultView) {
  if (result.kind === 'ITEM') return 'mdi-flask-outline';
  return result.icon ?? SLOT_ICONS[result.slot ?? 'WEAPON'];
}

async function handleCraft(recipe: CraftRecipeView) {
  if (!props.subLocation) return;
  craftingId.value = recipe.recipeId;
  try {
    const result = await craftingStore.craft(props.subLocation.id, recipe.recipeId);
    message.value = result.message;
    messageType.value = 'success';
  } catch (e: any) {
    message.value = e?.data?.message ?? 'Could not forge that.';
    messageType.value = 'error';
  } finally {
    craftingId.value = null;
  }
}
</script>
