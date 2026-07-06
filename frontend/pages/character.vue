<template>
  <div>
    <div class="text-h5 font-weight-bold mb-6">
      <v-icon color="primary" class="mr-2">mdi-account</v-icon>
      Character
    </div>

    <v-row v-if="character">
      <!-- Vitals -->
      <v-col cols="12" md="6">
        <v-card elevation="4" class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="accent">mdi-account-circle</v-icon>
            {{ character.username }}
            <v-chip v-if="character.isDead" color="error" size="small" class="ml-2">Dead</v-chip>
            <v-spacer />
            <v-chip color="primary" variant="tonal" size="small">Lv {{ character.level }}</v-chip>
          </v-card-title>

          <v-card-text>
            <div class="mb-4">
              <div class="d-flex justify-space-between mb-1">
                <span class="text-body-2 text-medium-emphasis">HP</span>
                <span class="text-body-2 font-weight-bold">{{ character.hp }} / {{ character.maxHp }}</span>
              </div>
              <v-progress-linear :model-value="(character.hp / character.maxHp) * 100" color="error" bg-color="surface" height="10" rounded />
              <div v-if="character.combat.healthRegenPerCycle > 0" class="text-caption text-success mt-1">
                +{{ character.combat.healthRegenPerCycle.toFixed(1) }} HP / 10s regen
              </div>
            </div>

            <div class="mb-4">
              <div class="d-flex justify-space-between mb-1">
                <span class="text-body-2 text-medium-emphasis">EXP</span>
                <span class="text-body-2 font-weight-bold">{{ character.exp }} / {{ character.expToNextLevel }}</span>
              </div>
              <v-progress-linear :model-value="(character.exp / character.expToNextLevel) * 100" color="info" bg-color="surface" height="10" rounded />
            </div>

            <v-row dense>
              <v-col cols="6">
                <v-list-item density="compact" prepend-icon="mdi-gold" title="Gold" :subtitle="String(character.gold)" />
              </v-col>
              <v-col cols="6">
                <v-list-item density="compact" prepend-icon="mdi-sword-cross" title="Attack" :subtitle="`${character.combat.attackDamage} dmg`" />
              </v-col>
            </v-row>

            <!-- Combat summary -->
            <v-divider class="my-3" />
            <div class="text-overline text-medium-emphasis mb-2">Combat</div>
            <v-row dense>
              <v-col v-for="c in combatSummary" :key="c.label" cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ c.label }}</div>
                <div class="text-body-2 font-weight-bold" :class="c.color">{{ c.value }}</div>
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions v-if="character.isDead" class="pa-4 pt-0">
            <v-btn color="success" variant="tonal" prepend-icon="mdi-heart" :loading="busy" @click="run(() => characterStore.resurrect())">
              Resurrect
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Core stats -->
      <v-col cols="12" md="6">
        <v-card elevation="4" class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="accent">mdi-chart-box</v-icon>
            Stats
            <v-spacer />
            <v-chip v-if="character.statPoints > 0" color="success" size="small" prepend-icon="mdi-plus-circle">
              {{ character.statPoints }} points
            </v-chip>
          </v-card-title>

          <v-card-text>
            <div v-for="stat in CORE_STATS" :key="stat" class="d-flex align-center mb-3">
              <v-icon size="20" class="mr-2 text-medium-emphasis">{{ STAT_META[stat].icon }}</v-icon>
              <div class="flex-grow-1">
                <div class="d-flex justify-space-between">
                  <span class="text-body-2">{{ STAT_META[stat].label }}</span>
                  <span class="text-body-2 font-weight-bold">{{ fmt(stat, character.stats[stat].final) }}</span>
                </div>
                <div class="text-caption text-medium-emphasis">
                  base {{ character.stats[stat].base }}
                  <span v-if="character.stats[stat].equipment" :class="character.stats[stat].equipment > 0 ? 'text-success' : 'text-error'">
                    · gear {{ signed(character.stats[stat].equipment) }}
                  </span>
                  <span v-if="character.stats[stat].perk" class="text-info">· perk {{ signed(character.stats[stat].perk) }}</span>
                </div>
              </div>
              <v-btn
                icon="mdi-plus"
                size="x-small"
                variant="tonal"
                color="success"
                class="ml-2"
                :disabled="character.statPoints < 1 || busy"
                @click="run(() => characterStore.allocateStat(stat))"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Equipment -->
      <v-col cols="12">
        <v-card elevation="4">
          <v-card-title>
            <v-icon class="mr-2" color="accent">mdi-shield-sword</v-icon>
            Equipment
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col v-for="slot in EQUIPMENT_SLOTS" :key="slot" cols="12" sm="6" md="4" lg="2">
                <v-card
                  variant="outlined"
                  class="h-100 equip-slot"
                  :class="slotClasses(slot)"
                  :style="equippedStyle(slot)"
                  :draggable="!!character.equipment[slot]"
                  @dragstart="character.equipment[slot] && onSlotDragStart(character.equipment[slot]!.ownedId, slot)"
                  @dragend="uiStore.endDrag()"
                  @dragover.prevent="dragOverSlot = slot"
                  @dragleave="dragOverSlot = null"
                  @drop="onDropOnSlot(slot)"
                >
                  <v-card-text class="pa-3">
                    <div class="text-overline text-medium-emphasis d-flex align-center">
                      <v-icon size="16" class="mr-1">{{ SLOT_META[slot].icon }}</v-icon>{{ SLOT_META[slot].label }}
                    </div>
                    <template v-if="character.equipment[slot]">
                      <div class="d-flex align-center mt-1">
                        <v-icon size="16" class="mr-1">{{ character.equipment[slot]!.icon ?? SLOT_META[slot].icon }}</v-icon>
                        <span class="font-weight-bold text-body-2">{{ character.equipment[slot]!.name }}</span>
                      </div>
                      <div v-if="character.equipment[slot]!.baseDamage" class="text-caption text-error">{{ character.equipment[slot]!.baseDamage }} dmg</div>
                      <div class="mt-1">
                        <v-chip
                          v-for="(val, key) in character.equipment[slot]!.modifiers"
                          :key="key"
                          size="x-small"
                          class="mr-1 mb-1"
                          :color="(val ?? 0) > 0 ? 'success' : 'error'"
                          variant="tonal"
                        >
                          {{ signed(val ?? 0) }} {{ STAT_META[key as CoreStat].label }}
                        </v-chip>
                      </div>
                      <v-btn
                        size="x-small"
                        variant="text"
                        color="error"
                        class="mt-1 px-1"
                        :disabled="busy"
                        @click="run(() => characterStore.unequip(slot))"
                      >
                        Unequip
                      </v-btn>
                    </template>
                    <div v-else class="text-caption text-disabled mt-2">Empty</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            <div class="text-caption text-medium-emphasis mt-3">
              <v-icon size="14" class="mr-1">mdi-bag-personal</v-icon>
              Drag gear from the Inventory window (bottom-right) onto a matching slot, or use its Equip button.
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Perks -->
      <v-col cols="12">
        <v-card elevation="4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="accent">mdi-star-four-points</v-icon>
            Perks
            <v-spacer />
            <v-chip v-if="character.perkPoints > 0" color="success" size="small" prepend-icon="mdi-plus-circle">{{ character.perkPoints }} points</v-chip>
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col v-for="perk in characterStore.perks" :key="perk.code" cols="12" sm="6" md="4">
                <v-card variant="outlined" :class="{ 'border-success': perk.unlocked }">
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-center">
                      <span class="font-weight-bold">{{ perk.name }}</span>
                      <v-chip v-if="perk.unlocked" size="x-small" color="success" variant="flat">Owned</v-chip>
                      <v-chip v-else size="x-small" variant="outlined">Lv {{ perk.requiredLevel }}</v-chip>
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1">{{ perk.description }}</div>
                    <v-btn
                      v-if="!perk.unlocked"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      class="mt-2"
                      :disabled="!perk.canUnlock || busy"
                      @click="run(() => characterStore.unlockPerk(perk.code))"
                    >
                      {{ character.level < perk.requiredLevel ? `Requires Lv ${perk.requiredLevel}` : character.perkPoints < 1 ? 'No points' : 'Unlock' }}
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-skeleton-loader v-else-if="characterStore.loading" type="card, card" />
  </div>
</template>

<script setup lang="ts">
import { CORE_STATS, EQUIPMENT_SLOTS, type CoreStat, type EquipmentSlot } from '~/stores/character';

definePageMeta({ middleware: 'auth' });

const characterStore = useCharacterStore();
const uiStore = useUiStore();
const { character } = storeToRefs(characterStore);

const busy = ref(false);

const STAT_META: Record<CoreStat, { label: string; icon: string }> = {
  strength: { label: 'Strength', icon: 'mdi-arm-flex' },
  agility: { label: 'Agility', icon: 'mdi-run-fast' },
  accuracy: { label: 'Accuracy', icon: 'mdi-target' },
  endurance: { label: 'Endurance', icon: 'mdi-shield-heart' },
  criticalDamage: { label: 'Crit Damage', icon: 'mdi-fire' },
  defense: { label: 'Defense', icon: 'mdi-shield' },
};

const SLOT_META: Record<EquipmentSlot, { label: string; icon: string }> = {
  WEAPON: { label: 'Weapon', icon: 'mdi-sword' },
  HELMET: { label: 'Helmet', icon: 'mdi-hard-hat' },
  BODY: { label: 'Body', icon: 'mdi-tshirt-crew' },
  PANTS: { label: 'Pants', icon: 'mdi-human-handsdown' },
  GLOVES: { label: 'Gloves', icon: 'mdi-hand-back-right' },
};

// --- Drag-and-drop equip (alternative to the Equip button in the Inventory window) ---
// Dragging OUT of an occupied slot (source: 'slot') is picked up by the
// InventoryWindow's drop zone, which unequips it — see components/InventoryWindow.vue.
const dragOverSlot = ref<EquipmentSlot | null>(null);

function onSlotDragStart(ownedId: number, slot: EquipmentSlot) {
  uiStore.startDrag({ ownedId, slot, source: 'slot' });
}

// Highlights the one matching slot as soon as a bag item starts dragging (not
// just on hover), and dims the rest so it's obvious where the item can go.
function slotClasses(slot: EquipmentSlot) {
  const dragged = uiStore.draggedGear;
  if (!dragged || dragged.source !== 'bag') return {};
  const isMatch = dragged.slot === slot;
  return {
    'dropzone-valid': isMatch,
    'dropzone-invalid': !isMatch,
    'dropzone-hover': isMatch && dragOverSlot.value === slot,
  };
}

function onDropOnSlot(slot: EquipmentSlot) {
  dragOverSlot.value = null;
  const dragged = uiStore.draggedGear;
  uiStore.endDrag();
  if (!dragged || dragged.source !== 'bag' || dragged.slot !== slot || busy.value) return;
  run(() => characterStore.equip(dragged.ownedId));
}

const combatSummary = computed(() => {
  const char = character.value;
  if (!char) return [];
  const c = char.combat;
  const def = Math.max(0, char.stats.defense.final);
  return [
    { label: 'Crit Chance', value: `${(c.critChance * 100).toFixed(0)}%`, color: 'text-warning' },
    { label: 'Crit Dmg', value: `${(c.critMultiplier * 100).toFixed(0)}%`, color: 'text-warning' },
    { label: 'Evasion', value: `${(c.evasionChance * 100).toFixed(0)}%`, color: 'text-info' },
    { label: 'Cooldown', value: c.attackCooldownMs ? `${c.attackCooldownMs}ms` : '—', color: 'text-info' },
    { label: 'Attack Spd', value: c.attackSpeed ? `${c.attackSpeed}/s` : '—', color: '' },
    { label: 'Def. Reduction', value: `${((def / (def + 100)) * 100).toFixed(0)}%`, color: 'text-success' },
  ];
});

function fmt(stat: CoreStat, value: number) {
  return stat === 'criticalDamage' ? `${value}%` : String(value);
}
function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
function equippedStyle(slot: EquipmentSlot) {
  const item = character.value?.equipment[slot];
  return item ? { borderColor: rarityColor(item.rarity) } : {};
}

async function run(action: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await action();
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  characterStore.fetch();
  characterStore.fetchGear();
  characterStore.fetchPerks();
});
</script>

<style scoped>
.equip-slot {
  transition: outline-color 0.15s ease, opacity 0.15s ease;
}
.dropzone-valid {
  outline: 2px dashed rgb(var(--v-theme-success));
  outline-offset: 2px;
}
.dropzone-hover {
  background-color: rgba(var(--v-theme-success), 0.12);
}
.dropzone-invalid {
  opacity: 0.45;
}
</style>
