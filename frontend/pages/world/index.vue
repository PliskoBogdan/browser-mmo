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
          <v-btn color="primary" :disabled="arrivedLocation.locked" :loading="entering" @click="handleEnterLocation(arrivedLocation.id)">
            {{ arrivedLocation.locked ? 'Locked' : 'Enter' }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <v-card v-if="arrivedRift" class="location-prompt" elevation="8">
        <v-card-title class="d-flex align-center">
          <v-icon color="deep-purple-accent-2" class="mr-2">mdi-orbit-variant</v-icon>
          {{ arrivedRift.name }}
          <v-chip size="x-small" class="ml-2" variant="tonal">Tier {{ arrivedRift.tier }}</v-chip>
          <v-chip size="x-small" class="ml-2" :color="arrivedRift.locked ? 'error' : 'info'">Lv {{ arrivedRift.minLevel }}+</v-chip>
        </v-card-title>
        <v-card-subtitle>A procedurally generated rift. Collapses in {{ timeLeft(arrivedRift.expiresAt) }}.</v-card-subtitle>
        <v-card-actions>
          <v-btn variant="text" @click="arrivedRift = null">Not now</v-btn>
          <v-spacer />
          <v-btn color="deep-purple-accent-2" :disabled="arrivedRift.locked" :loading="entering" @click="handleEnterRift(arrivedRift.id)">
            {{ arrivedRift.locked ? 'Locked' : 'Enter' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorldLocationNode, WorldRiftNode } from '~/stores/world';
import type { GridTile } from '~/components/world/GridScene.vue';

definePageMeta({ middleware: 'auth' });

const worldStore = useWorldStore();
const battleStore = useBattleStore();
const riftStore = useRiftStore();
const { overworld, position } = storeToRefs(worldStore);

const error = ref('');
const entering = ref(false);
const moving = ref(false);
const arrivedLocation = ref<WorldLocationNode | null>(null);
const arrivedRift = ref<WorldRiftNode | null>(null);
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

const tiles = computed<GridTile[]>(() => {
  if (!overworld.value) return [];
  const locationTiles: GridTile[] = overworld.value.locations.map((l) => ({
    x: l.mapX,
    y: l.mapY,
    kind: l.locked ? 'LOCATION_LOCKED' : 'LOCATION',
    label: l.name,
    locked: l.locked,
  }));
  const riftTiles: GridTile[] = overworld.value.rifts.map((r) => ({
    x: r.mapX,
    y: r.mapY,
    kind: r.locked ? 'RIFT_LOCKED' : 'RIFT',
    label: `${r.name} (T${r.tier})`,
    locked: r.locked,
  }));
  return [...locationTiles, ...riftTiles];
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

  // Resume an unfinished rift expedition automatically — the player can't
  // move away from a rift's cell while a run is active, so if one exists
  // they're standing right on top of it.
  const activeRun = await riftStore.fetchCurrent();
  if (activeRun) {
    await navigateTo(`/rifts/${activeRun.id}`);
    return;
  }

  await worldStore.fetchWorld();
  // Coming back to this page (e.g. from Character) with the character
  // already standing on a location/rift cell should offer to enter it right
  // away — not require stepping off and back on to re-trigger the prompt.
  checkArrivalAtCurrentPosition();
  ticker = setInterval(() => (now.value = Date.now()), 30_000);
});

function checkArrivalAtCurrentPosition() {
  if (!overworld.value) return;
  const location = overworld.value.locations.find((l) => l.mapX === position.value.x && l.mapY === position.value.y);
  if (location) {
    arrivedLocation.value = location;
    return;
  }
  const rift = overworld.value.rifts.find((r) => r.mapX === position.value.x && r.mapY === position.value.y);
  if (rift) arrivedRift.value = rift;
}

onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

async function handleTileClick(x: number, y: number) {
  if (moving.value || entering.value || !overworld.value) return;
  const path = buildPath(position.value.x, position.value.y, x, y);
  moving.value = true;
  error.value = '';
  arrivedLocation.value = null;
  arrivedRift.value = null;
  try {
    for (const step of path) {
      const { location, rift } = await worldStore.moveOnWorld(step.x, step.y);
      if (location) {
        arrivedLocation.value = location;
        break;
      }
      if (rift) {
        arrivedRift.value = rift;
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

async function handleEnterLocation(locationId: number) {
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

async function handleEnterRift(riftId: number) {
  entering.value = true;
  error.value = '';
  try {
    await riftStore.enter(riftId);
    await navigateTo(`/rifts/${riftId}`);
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Could not enter this rift.';
  } finally {
    entering.value = false;
  }
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - now.value;
  if (ms <= 0) return 'moments';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  z-index: 10;
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
