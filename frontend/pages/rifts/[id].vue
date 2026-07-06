<template>
  <div class="d-flex flex-column" style="height: calc(100vh - 90px)">
    <div class="d-flex align-center mb-2">
      <div class="text-h5 font-weight-bold">
        <v-icon color="primary" class="mr-2">mdi-orbit-variant</v-icon>
        {{ view?.name ?? 'Loading...' }}
        <v-chip v-if="view" size="small" class="ml-2" variant="tonal">Tier {{ view.tier }}</v-chip>
      </div>
      <v-spacer />
      <v-btn color="success" variant="flat" prepend-icon="mdi-exit-run" :loading="extracting" @click="handleExtract">
        Extract{{ lootCount ? ` (${lootCount})` : '' }}
      </v-btn>
    </div>

    <div class="flex-grow-1 position-relative rounded-lg overflow-hidden scene-frame">
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="scene-alert" closable @click:close="error = ''">
        {{ error }}
      </v-alert>

      <ClientOnly>
        <WorldGridScene
          v-if="view"
          :width="view.gridWidth"
          :height="view.gridHeight"
          :tiles="tiles"
          :player-pos="view.position"
          sparse
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

      <!-- Keys & tools: what gate items the player is carrying right now,
           so a locked door or dark cave never comes as a surprise. -->
      <v-card v-if="view" class="keys-panel" elevation="8" density="compact">
        <v-card-title class="text-body-2 py-1">
          <v-icon size="16" class="mr-1">mdi-key-variant</v-icon>
          Keys & Tools
        </v-card-title>
        <v-card-text class="py-1 d-flex ga-2">
          <v-chip v-for="key in view.keyItems" :key="key.name" size="small" :color="key.quantity > 0 ? 'amber' : undefined" variant="tonal">
            <v-icon start size="14">{{ key.name === 'Torch' ? 'mdi-torch' : 'mdi-key' }}</v-icon>
            {{ key.name }} ×{{ key.quantity }}
          </v-chip>
        </v-card-text>
      </v-card>

      <!-- Rift bag + actions overlay -->
      <v-card v-if="view" class="bag-panel" elevation="8" density="compact">
        <v-card-title class="text-body-1 py-2">
          <v-icon size="18" class="mr-1">mdi-bag-personal</v-icon>
          Rift bag
          <v-tooltip activator="parent" location="top">Lost on death (half), banked when you extract</v-tooltip>
        </v-card-title>
        <v-card-text class="py-1">
          <div v-if="!view.lootBag.length" class="text-caption text-medium-emphasis">Empty. Go find something.</div>
          <div v-else class="d-flex flex-column ga-1">
            <v-chip v-for="entry in view.lootBag" :key="entry.itemId" size="small" :color="rarityColor(entry.rarity)" variant="tonal">
              {{ entry.name }} ×{{ entry.quantity }}
            </v-chip>
          </div>
        </v-card-text>
        <v-card-actions v-if="canGather" class="pt-0">
          <v-btn color="teal" variant="flat" size="small" block prepend-icon="mdi-hand-extended" :loading="gathering" @click="handleGather">
            Gather {{ currentTile?.resourceItemName }} ({{ currentTile?.charges }})
          </v-btn>
        </v-card-actions>
        <v-card-actions v-else-if="canOpenChest" class="pt-0">
          <v-btn color="amber-darken-2" variant="flat" size="small" block prepend-icon="mdi-treasure-chest" :loading="gathering" @click="handleGather">
            Open Chest
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <v-snackbar v-model="snackbar" timeout="3600">{{ snackbarText }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import type { GridTile, TileKind } from '~/components/world/GridScene.vue';
import type { RiftTileView } from '~/stores/rift';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const riftId = computed(() => Number(route.params.id));

const riftStore = useRiftStore();
const battleStore = useBattleStore();
const characterStore = useCharacterStore();
const { view } = storeToRefs(riftStore);

const error = ref('');
const moving = ref(false);
const gathering = ref(false);
const extracting = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');

const lootCount = computed(() => view.value?.lootBag.reduce((s, e) => s + e.quantity, 0) ?? 0);

const currentTile = computed<RiftTileView | null>(() => {
  if (!view.value) return null;
  return view.value.tiles.find((t) => t.x === view.value!.position.x && t.y === view.value!.position.y) ?? null;
});

const canGather = computed(() => currentTile.value?.kind === 'RESOURCE' && (currentTile.value.charges ?? 0) > 0);
const canOpenChest = computed(() => currentTile.value?.kind === 'CHEST' && (currentTile.value.charges ?? 0) > 0);

const tiles = computed<GridTile[]>(() => {
  if (!view.value) return [];
  return view.value.tiles.map((t) => ({ x: t.x, y: t.y, kind: sceneKind(t), label: sceneLabel(t), roomId: t.roomId }));
});

// Map the server's tile view onto scene colors: cleared monsters read as
// plain path, depleted resources go dim, unexplored gates keep their color so
// the player can see what blocks the way.
function sceneKind(t: RiftTileView): TileKind {
  switch (t.kind) {
    case 'FOG':
      return 'FOG';
    case 'ENTRANCE':
      return 'ENTRANCE';
    case 'MONSTER':
      return t.monsterAlive ? 'MONSTER' : 'PATH';
    case 'BOSS':
      return t.monsterAlive ? 'BOSS' : 'PATH';
    case 'RESOURCE':
      return (t.charges ?? 0) > 0 ? 'RESOURCE' : 'RESOURCE_EMPTY';
    case 'CHEST':
      return (t.charges ?? 0) > 0 ? 'CHEST' : 'CHEST_OPENED';
    case 'LOCKED':
      return t.explored ? 'PATH' : 'LOCKED';
    case 'DARK':
      return t.explored ? 'PATH' : 'DARK';
    default:
      return 'PATH';
  }
}

// Labels are reserved for tiles worth calling out — a room is already shown
// by its floor/walls, so plain floor (whether corridor or empty room tile)
// gets no label at all; only actual content (loot, a threat, an unopened
// gate) does.
function sceneLabel(t: RiftTileView): string | undefined {
  if (t.kind === 'FOG') return undefined;
  if (t.kind === 'ENTRANCE') return 'Entrance';
  if (!t.explored && (t.kind === 'LOCKED' || t.kind === 'DARK')) {
    return t.requiredItemName ? `${t.name} — needs ${t.requiredItemName}` : t.name;
  }
  if ((t.kind === 'MONSTER' || t.kind === 'BOSS') && t.monsterAlive) return t.monsterName ?? t.name;
  if (t.kind === 'RESOURCE' && (t.charges ?? 0) > 0) return `${t.resourceItemName} (${t.charges})`;
  if (t.kind === 'CHEST' && (t.charges ?? 0) > 0) return 'Chest';
  return undefined;
}

onMounted(async () => {
  await battleStore.fetchCurrent();
  if (battleStore.battle) {
    await navigateTo('/battle');
    return;
  }
  try {
    const run = await riftStore.fetchCurrent();
    if (!run || run.id !== riftId.value) {
      await navigateTo('/world');
    }
  } catch {
    await navigateTo('/world');
  }
});

// A tile can be walked through automatically once it's explored — except a
// still-alive monster, which must be fought before continuing past it. Fog
// and gate tiles can only ever be the final step of a path (that's what
// "discovering" them means).
function isPassable(tile: RiftTileView, isDestination: boolean): boolean {
  if (!tile.explored) return isDestination;
  if ((tile.kind === 'MONSTER' || tile.kind === 'BOSS') && tile.monsterAlive) return isDestination;
  return true;
}

function findPath(tiles: RiftTileView[], from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const byKey = new Map(tiles.map((t) => [key(t.x, t.y), t]));
  if (!byKey.has(key(to.x, to.y))) return null;

  const startKey = key(from.x, from.y);
  const endKey = key(to.x, to.y);
  if (startKey === endKey) return [];

  const cameFrom = new Map<string, { x: number; y: number } | null>([[startKey, null]]);
  const queue: { x: number; y: number }[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (key(cur.x, cur.y) === endKey) break;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      const nk = key(next.x, next.y);
      if (cameFrom.has(nk)) continue;
      const tile = byKey.get(nk);
      if (!tile) continue;
      if (!isPassable(tile, nk === endKey)) continue;
      cameFrom.set(nk, cur);
      queue.push(next);
    }
  }
  if (!cameFrom.has(endKey)) return null;

  const path: { x: number; y: number }[] = [];
  let cur: { x: number; y: number } | null = { x: to.x, y: to.y };
  while (cur && key(cur.x, cur.y) !== startKey) {
    path.unshift(cur);
    cur = cameFrom.get(key(cur.x, cur.y)) ?? null;
  }
  return path;
}

async function handleTileClick(x: number, y: number) {
  if (moving.value || !view.value) return;
  if (x === view.value.position.x && y === view.value.position.y) return;

  const path = findPath(view.value.tiles, view.value.position, { x, y });
  if (!path || !path.length) {
    error.value = 'You cannot reach that tile yet.';
    return;
  }

  moving.value = true;
  error.value = '';
  try {
    for (const step of path) {
      const result = await riftStore.move(step.x, step.y);
      if (result.events.length) showSnackbar(result.events.join(' '));
      if (result.expGained || result.leveledUp) characterStore.fetch();
      if (result.battleStarted) {
        await navigateTo('/battle');
        return;
      }
      await sleep(180);
    }
  } catch (e: any) {
    if (e?.data?.statusCode === 403 && (await redirectIfInBattle())) return;
    error.value = e?.data?.message ?? 'Could not move there.';
  } finally {
    moving.value = false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleGather() {
  gathering.value = true;
  error.value = '';
  try {
    const result = await riftStore.gather();
    showSnackbar(result.message);
    if (result.goldGained > 0) characterStore.fetch();
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Could not gather.';
  } finally {
    gathering.value = false;
  }
}

async function handleExtract() {
  extracting.value = true;
  error.value = '';
  try {
    const result = await riftStore.extract();
    showSnackbar(result.message);
    await navigateTo('/world');
  } catch (e: any) {
    if (e?.data?.statusCode === 403 && (await redirectIfInBattle())) return;
    error.value = e?.data?.message ?? 'Could not extract.';
  } finally {
    extracting.value = false;
  }
}

async function redirectIfInBattle() {
  await battleStore.fetchCurrent();
  if (battleStore.battle) {
    await navigateTo('/battle');
    return true;
  }
  return false;
}

function showSnackbar(text: string) {
  snackbarText.value = text;
  snackbar.value = true;
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

.bag-panel {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 230px;
  z-index: 2;
  background: rgba(15, 18, 26, 0.9);
}

.keys-panel {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 2;
  background: rgba(15, 18, 26, 0.9);
}
</style>
