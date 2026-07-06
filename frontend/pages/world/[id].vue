<template>
  <div class="d-flex flex-column" style="height: calc(100vh - 90px)">
    <div class="d-flex align-center mb-2">
      <div class="text-h5 font-weight-bold">
        <v-icon color="primary" class="mr-2">mdi-map</v-icon>
        {{ currentLocation?.name ?? 'Loading...' }}
      </div>
      <v-spacer />
      <v-btn variant="tonal" prepend-icon="mdi-exit-to-app" :loading="leaving" @click="handleLeave">Exit to map</v-btn>
    </div>

    <div class="flex-grow-1 position-relative rounded-lg overflow-hidden scene-frame">
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="scene-alert" closable @click:close="error = ''">
        {{ error }}
      </v-alert>

      <ClientOnly>
        <WorldGridScene
          v-if="currentLocation"
          :width="currentLocation.gridWidth"
          :height="currentLocation.gridHeight"
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
    </div>

    <v-snackbar v-model="snackbar" timeout="3200">{{ snackbarText }}</v-snackbar>

    <WorldShopModal v-model="shopOpen" :sub-location="shopSubLocation" />
    <WorldForgeModal v-model="forgeOpen" :sub-location="forgeSubLocation" />
  </div>
</template>

<script setup lang="ts">
import type { SubLocationCell } from '~/stores/world';
import type { GridTile } from '~/components/world/GridScene.vue';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const locationId = computed(() => Number(route.params.id));

const worldStore = useWorldStore();
const battleStore = useBattleStore();
const { currentLocation, position } = storeToRefs(worldStore);

const error = ref('');
const moving = ref(false);
const leaving = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');
const shopOpen = ref(false);
const shopSubLocation = ref<SubLocationCell | null>(null);
const forgeOpen = ref(false);
const forgeSubLocation = ref<SubLocationCell | null>(null);

const tiles = computed<GridTile[]>(() => {
  if (!currentLocation.value) return [];
  return currentLocation.value.subLocations.map((s) => ({
    x: s.gridX,
    y: s.gridY,
    kind: s.kind,
    label: s.name,
  }));
});

onMounted(async () => {
  await battleStore.fetchCurrent();
  if (battleStore.battle) {
    await navigateTo('/battle');
    return;
  }

  await worldStore.ensureHydrated();

  if (position.value.locationId !== locationId.value) {
    await navigateTo('/world');
    return;
  }
  await worldStore.fetchLocation(locationId.value);
});

async function handleTileClick(x: number, y: number) {
  if (moving.value || !currentLocation.value) return;
  const path = buildPath(position.value.x, position.value.y, x, y);
  moving.value = true;
  error.value = '';
  try {
    for (const step of path) {
      const subLocation = await worldStore.moveInLocation(step.x, step.y);
      if (subLocation) {
        await handleArrival(subLocation);
        break;
      }
      await sleep(220);
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

async function handleArrival(subLocation: SubLocationCell) {
  if (subLocation.kind === 'DANGER') {
    try {
      const result = await battleStore.enter(subLocation.id);
      if (!result.isSafe && battleStore.battle) {
        await navigateTo('/battle');
      } else {
        showSnackbar(result.message);
      }
    } catch (e: any) {
      error.value = e?.data?.message ?? 'Could not enter this area.';
    }
  } else if (subLocation.kind === 'SHOP' || subLocation.kind === 'LOOT_SHOP') {
    shopSubLocation.value = subLocation;
    shopOpen.value = true;
  } else if (subLocation.kind === 'FORGE') {
    forgeSubLocation.value = subLocation;
    forgeOpen.value = true;
  } else {
    showSnackbar(subLocation.description ?? `You arrive at ${subLocation.name}.`);
  }
}

function showSnackbar(text: string) {
  snackbarText.value = text;
  snackbar.value = true;
}

async function handleLeave() {
  leaving.value = true;
  error.value = '';
  try {
    await worldStore.leaveLocation();
    await navigateTo('/world');
  } catch (e: any) {
    if (e?.data?.statusCode === 403) {
      await battleStore.fetchCurrent();
      if (battleStore.battle) {
        await navigateTo('/battle');
        return;
      }
    }
    error.value = e?.data?.message ?? 'Could not leave.';
  } finally {
    leaving.value = false;
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

.scene-alert {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: min(520px, 90%);
  z-index: 3;
}
</style>
