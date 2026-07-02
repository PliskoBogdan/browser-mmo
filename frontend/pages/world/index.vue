<template>
  <div class="d-flex flex-column" style="height: calc(100vh - 90px)">
    <div class="d-flex align-center mb-2">
      <div class="text-h5 font-weight-bold">
        <v-icon color="primary" class="mr-2">mdi-earth</v-icon>
        World Map
      </div>
      <v-spacer />
      <v-chip size="small" color="secondary" variant="tonal">Walk to a location to enter it</v-chip>
    </div>

    <div class="flex-grow-1 position-relative rounded-lg overflow-hidden scene-frame">
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="scene-alert" closable @click:close="error = ''">
        {{ error }}
      </v-alert>

      <ClientOnly>
        <WorldGridScene
          v-if="overworld"
          :width="overworld.width"
          :height="overworld.height"
          :tiles="tiles"
          :player-pos="{ x: position.x, y: position.y }"
          @tile-click="handleTileClick"
        />
        <div v-else class="d-flex align-center justify-center fill-height">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <template #fallback>
          <div class="d-flex align-center justify-center fill-height">
            <v-progress-circular indeterminate color="primary" />
          </div>
        </template>
      </ClientOnly>

      <v-card v-if="arrivedLocation" class="location-prompt" elevation="8">
        <v-card-title class="d-flex align-center">
          <v-icon color="info" class="mr-2">mdi-map-marker</v-icon>
          {{ arrivedLocation.name }}
          <v-chip size="x-small" class="ml-2" :color="arrivedLocation.locked ? 'error' : 'info'">Lv {{ arrivedLocation.minLevel }}+</v-chip>
        </v-card-title>
        <v-card-subtitle v-if="arrivedLocation.description">{{ arrivedLocation.description }}</v-card-subtitle>
        <v-card-actions>
          <v-btn variant="text" @click="arrivedLocation = null">Not now</v-btn>
          <v-spacer />
          <v-btn color="primary" :disabled="arrivedLocation.locked" :loading="entering" @click="handleEnter(arrivedLocation.id)">
            {{ arrivedLocation.locked ? 'Locked' : 'Enter' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorldLocationNode } from '~/stores/world';
import type { GridTile } from '~/components/world/GridScene.vue';

definePageMeta({ middleware: 'auth' });

const worldStore = useWorldStore();
const battleStore = useBattleStore();
const { overworld, position } = storeToRefs(worldStore);

const error = ref('');
const entering = ref(false);
const moving = ref(false);
const arrivedLocation = ref<WorldLocationNode | null>(null);

const tiles = computed<GridTile[]>(() => {
  if (!overworld.value) return [];
  return overworld.value.locations.map((l) => ({
    x: l.mapX,
    y: l.mapY,
    kind: l.locked ? 'LOCATION_LOCKED' : 'LOCATION',
    label: l.name,
    locked: l.locked,
  }));
});

onMounted(async () => {
  await battleStore.fetchCurrent();
  if (battleStore.battle) {
    await navigateTo('/battle');
    return;
  }

  await worldStore.ensureHydrated();

  if (position.value.locationId !== null) {
    await navigateTo(`/world/${position.value.locationId}`);
    return;
  }
  await worldStore.fetchWorld();
});

async function handleTileClick(x: number, y: number) {
  if (moving.value || entering.value || !overworld.value) return;
  const path = buildPath(position.value.x, position.value.y, x, y);
  moving.value = true;
  error.value = '';
  arrivedLocation.value = null;
  try {
    for (const step of path) {
      const location = await worldStore.moveOnWorld(step.x, step.y);
      if (location) {
        arrivedLocation.value = location;
        break;
      }
      await sleep(200);
    }
  } catch (e: any) {
    if (e?.data?.statusCode === 403) {
      await battleStore.fetchCurrent();
      if (battleStore.battle) {
        await navigateTo('/battle');
        return;
      }
    }
    error.value = e?.data?.message ?? 'Could not move there.';
  } finally {
    moving.value = false;
  }
}

async function handleEnter(locationId: number) {
  entering.value = true;
  error.value = '';
  try {
    await worldStore.enterLocation(locationId);
    await navigateTo(`/world/${locationId}`);
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Could not enter this location.';
  } finally {
    entering.value = false;
  }
}

function buildPath(fromX: number, fromY: number, toX: number, toY: number) {
  const path: { x: number; y: number }[] = [];
  let x = fromX;
  let y = fromY;
  while (x !== toX) {
    x += x < toX ? 1 : -1;
    path.push({ x, y });
  }
  while (y !== toY) {
    y += y < toY ? 1 : -1;
    path.push({ x, y });
  }
  return path;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
</script>

<style scoped>
.scene-frame {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #0b0d12;
}

.location-prompt {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(420px, 90%);
  z-index: 2;
}

.scene-alert {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: min(520px, 90%);
  z-index: 3;
}
</style>
