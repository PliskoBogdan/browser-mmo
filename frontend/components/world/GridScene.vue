<template>
  <div class="grid-scene">
    <TresCanvas render-mode="on-demand" clear-color="#0b0d12">
      <TresPerspectiveCamera :position="cameraPosition" :fov="42" />
      <OrbitControls
        :enable-pan="false"
        :enable-damping="true"
        :damping-factor="0.12"
        :min-distance="cameraDistance * 0.6"
        :max-distance="cameraDistance * 1.4"
        :min-polar-angle="0.6"
        :max-polar-angle="1.05"
      />

      <TresFog attach="fog" :args="['#0b0d12', cameraDistance * 1.2, cameraDistance * 3.2]" />
      <TresAmbientLight :intensity="0.65" color="#aab4c8" />
      <TresDirectionalLight :position="vec3(6, 10, 4)" :intensity="1.15" color="#fff2df" />

      <!-- Room grouping: a shared floor plate + low perimeter walls around
           every room's bounding box, so a 2x2..6x6 room visually reads as
           one enclosed place — no per-tile label needed. Corridor tiles
           (roomId null) get neither. -->
      <TresMesh
        v-for="plate in roomPlates"
        :key="`room-${plate.roomId}`"
        :position="vec3(plate.cx, -0.1, plate.cz)"
        :scale="vec3(plate.w, 1, plate.d)"
        :geometry="roomPlateGeometry"
        :material="plate.material"
      />
      <TresMesh
        v-for="wall in roomWalls"
        :key="`wall-${wall.key}`"
        :position="vec3(wall.cx, ROOM_WALL_HEIGHT / 2, wall.cz)"
        :scale="vec3(wall.sx, ROOM_WALL_HEIGHT, wall.sz)"
        :geometry="roomWallGeometry"
        :material="wall.material"
      />

      <TresMesh
        v-for="tile in cells"
        :key="`${tile.x}-${tile.y}`"
        :position="vec3(worldX(tile.x), tileY(tile), worldZ(tile.y))"
        :geometry="tileGeometry"
        :material="tileMaterial(tile)"
        @click="onTileClick(tile)"
        @pointerenter="hoveredKey = cellKey(tile.x, tile.y)"
        @pointerleave="hoveredKey = null"
      />

      <!-- Cave walls (rift maps only): boulders fill the solid cells hugging
           the explored tiles, so corridors and rooms read as carved through
           rock. Rocks never intercept pointer events (raycast disabled). -->
      <TresGroup v-for="rock in rockProps" :key="`rock-${rock.key}`">
        <primitive :object="rock.object" />
      </TresGroup>

      <!-- Chest prop: a basicchest.glb model with a skinned lid bone that
           swings open once emptied. -->
      <TresGroup
        v-for="entry in chestProps"
        :key="`chest-${entry.tile.x}-${entry.tile.y}`"
        :position="vec3(worldX(entry.tile.x), CHEST_GROUP_Y, worldZ(entry.tile.y))"
        :scale="vec3(CHEST_SCALE, CHEST_SCALE, CHEST_SCALE)"
      >
        <primitive :object="entry.object" />
      </TresGroup>

      <!-- Boss marker: a small flickering campfire + warm point light, so the
           whole arena reads as lit by it (the ember floor/walls pick up the
           flicker through real lighting, no material animation needed). -->
      <TresGroup v-for="tile in bossTiles" :key="`boss-fire-${tile.x}-${tile.y}`" :position="vec3(worldX(tile.x), 0, worldZ(tile.y))">
        <TresPointLight :position="vec3(0, 0.55, 0)" :intensity="1.6 * fireFlicker" color="#ff8a3d" :distance="4.5" />
        <TresMesh :position="vec3(0, 0.16, 0)" :scale="vec3(fireFlicker, fireFlicker * 1.15, fireFlicker)" :geometry="fireOuterGeometry" :material="fireOuterMaterial" />
        <TresMesh :position="vec3(0.07, 0.12, 0.04)" :scale="vec3(fireFlicker * 0.8, fireFlicker * 0.95, fireFlicker * 0.8)" :geometry="fireInnerGeometry" :material="fireInnerMaterial" />
        <TresMesh :position="vec3(-0.06, 0.1, -0.03)" :scale="vec3(fireFlicker * 0.65, fireFlicker * 0.8, fireFlicker * 0.65)" :geometry="fireInnerGeometry" :material="fireCoreMaterial" />
      </TresGroup>

      <Html
        v-for="tile in labelledCells"
        :key="`label-${tile.x}-${tile.y}`"
        :position="vec3(worldX(tile.x), 0.55, worldZ(tile.y))"
        center
        :distance-factor="8"
        :z-index-range="[10, 0]"
      >
        <div class="tile-label" :class="tile.kind.toLowerCase()">{{ tile.label }}</div>
      </Html>

      <TresMesh :position="vec3(tokenPos.x, 0.02, tokenPos.z)" :rotation-x="-Math.PI / 2" :geometry="shadowGeometry" :material="shadowMaterial" />
      <TresGroup :position="vec3(tokenPos.x, tokenPos.y, tokenPos.z)">
        <TresMesh :position="vec3(0, 0.35, 0)" :geometry="tokenBodyGeometry" :material="tokenBodyMaterial" />
        <TresMesh :position="vec3(0, 0.72, 0)" :geometry="tokenHeadGeometry" :material="tokenHeadMaterial" />
      </TresGroup>
    </TresCanvas>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { TresCanvas } from '@tresjs/core';
import { OrbitControls, Html, useGLTF } from '@tresjs/cientos';
import gsap from 'gsap';

export type TileKind =
  | 'EMPTY'
  | 'SAFE'
  | 'SHOP'
  | 'LOOT_SHOP'
  | 'FORGE'
  | 'DANGER'
  | 'LOCATION'
  | 'LOCATION_LOCKED'
  | 'RIFT'
  | 'RIFT_LOCKED'
  // Rift interior tiles (fog-of-war maps)
  | 'FOG'
  | 'PATH'
  | 'ENTRANCE'
  | 'MONSTER'
  | 'BOSS'
  | 'RESOURCE'
  | 'RESOURCE_EMPTY'
  | 'CHEST'
  | 'CHEST_OPENED'
  | 'LOCKED'
  | 'DARK';

export interface GridTile {
  x: number;
  y: number;
  kind: TileKind;
  label?: string;
  locked?: boolean;
  // Groups this tile into a shared room floor plate; null/undefined = corridor.
  roomId?: number | null;
}

const props = defineProps<{
  width: number;
  height: number;
  tiles: GridTile[];
  playerPos: { x: number; y: number };
  // Sparse maps (rifts) render only the provided tiles — missing cells are
  // solid rock, not clickable EMPTY floor.
  sparse?: boolean;
}>();

const emit = defineEmits<{ tileClick: [x: number, y: number] }>();

function vec3(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z);
}

const cameraDistance = computed(() => Math.max(props.width, props.height) * 1.6 + 3);
const cameraPosition = computed(() => {
  const d = cameraDistance.value;
  return vec3(d * 0.72, d * 0.82, d * 0.72);
});

function worldX(x: number) {
  return x - (props.width - 1) / 2;
}
function worldZ(y: number) {
  return y - (props.height - 1) / 2;
}
function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

const cells = computed<GridTile[]>(() => {
  if (props.sparse) return props.tiles;
  const map = new Map(props.tiles.map((t) => [cellKey(t.x, t.y), t]));
  const result: GridTile[] = [];
  for (let y = 0; y < props.height; y++) {
    for (let x = 0; x < props.width; x++) {
      result.push(map.get(cellKey(x, y)) ?? { x, y, kind: 'EMPTY' });
    }
  }
  return result;
});

const labelledCells = computed(() => cells.value.filter((t) => t.kind !== 'EMPTY' && t.label));
const chestTiles = computed(() => cells.value.filter((t) => t.kind === 'CHEST' || t.kind === 'CHEST_OPENED'));
const bossTiles = computed(() => cells.value.filter((t) => t.kind === 'BOSS'));
// The room containing the boss (if any explored) gets an ember-lit look
// instead of the normal room palette — the room itself reads as special,
// not just the tile the boss stands on.
const bossRoomId = computed<number | null>(() => bossTiles.value[0]?.roomId ?? null);

// Low-frequency flicker (not a 60fps loop) driving the campfire scale/light
// intensity — cheap enough to run continuously without fighting the
// renderer's on-demand mode, and only ticks while a boss is actually visible.
const fireFlicker = ref(1);
let fireFlickerInterval: ReturnType<typeof setInterval> | null = null;
watch(
  () => bossTiles.value.length > 0,
  (hasBoss) => {
    if (hasBoss && !fireFlickerInterval) {
      fireFlickerInterval = setInterval(() => {
        fireFlicker.value = 0.75 + Math.random() * 0.5;
      }, 130);
    } else if (!hasBoss && fireFlickerInterval) {
      clearInterval(fireFlickerInterval);
      fireFlickerInterval = null;
      fireFlicker.value = 1;
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  if (fireFlickerInterval) clearInterval(fireFlickerInterval);
});

// Room grouping: one floor plate + 4 perimeter walls per roomId, sized to
// that room's bounding box (rooms are always solid rectangles). Shared unit
// geometries are scaled per-instance so no per-render geometry allocation
// happens as the player explores (the tiles list changes on every move).
const ROOM_PALETTE = ['#33447a', '#3f7a44', '#7a3f6e', '#3f6e7a', '#7a5a3f', '#5a3f7a', '#7a6a3f', '#3f5a7a'];
const ROOM_WALL_HEIGHT = 0.55;
const ROOM_WALL_THICKNESS = 0.1;
const roomPlateGeometry = new THREE.BoxGeometry(1, 0.06, 1);
const roomWallGeometry = new THREE.BoxGeometry(1, 1, 1);
const roomMaterials = ROOM_PALETTE.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }));
// The boss's room gets this instead of a palette color — a dark ember tone
// that the flickering campfire light plays across, rather than a flat tint.
const bossRoomMaterial = new THREE.MeshStandardMaterial({ color: '#3d1310', roughness: 0.8, metalness: 0.05, emissive: '#2a0805', emissiveIntensity: 0.4 });

interface RoomBounds {
  roomId: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  material: THREE.MeshStandardMaterial;
}

const roomBounds = computed<RoomBounds[]>(() => {
  if (!props.sparse) return [];
  const groups = new Map<number, { x: number; y: number }[]>();
  for (const t of props.tiles) {
    if (t.roomId == null) continue;
    if (!groups.has(t.roomId)) groups.set(t.roomId, []);
    groups.get(t.roomId)!.push(t);
  }
  return [...groups.entries()].map(([roomId, pts]) => ({
    roomId,
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
    material: roomId === bossRoomId.value ? bossRoomMaterial : roomMaterials[roomId % roomMaterials.length],
  }));
});

const roomPlates = computed(() =>
  roomBounds.value.map((r) => ({
    roomId: r.roomId,
    cx: worldX((r.minX + r.maxX) / 2),
    cz: worldZ((r.minY + r.maxY) / 2),
    w: r.maxX - r.minX + 1,
    d: r.maxY - r.minY + 1,
    material: r.material,
  })),
);

const roomWalls = computed(() => {
  const walls: { key: string; cx: number; cz: number; sx: number; sz: number; material: THREE.MeshStandardMaterial }[] = [];
  for (const r of roomBounds.value) {
    const left = worldX(r.minX) - 0.5;
    const right = worldX(r.maxX) + 0.5;
    const top = worldZ(r.minY) - 0.5;
    const bottom = worldZ(r.maxY) + 0.5;
    const midX = (left + right) / 2;
    const midZ = (top + bottom) / 2;
    walls.push({ key: `${r.roomId}-n`, cx: midX, cz: top, sx: right - left, sz: ROOM_WALL_THICKNESS, material: r.material });
    walls.push({ key: `${r.roomId}-s`, cx: midX, cz: bottom, sx: right - left, sz: ROOM_WALL_THICKNESS, material: r.material });
    walls.push({ key: `${r.roomId}-w`, cx: left, cz: midZ, sx: ROOM_WALL_THICKNESS, sz: bottom - top, material: r.material });
    walls.push({ key: `${r.roomId}-e`, cx: right, cz: midZ, sx: ROOM_WALL_THICKNESS, sz: bottom - top, material: r.material });
  }
  return walls;
});

const hoveredKey = ref<string | null>(null);

function tileY(tile: GridTile) {
  return hoveredKey.value === cellKey(tile.x, tile.y) ? 0.07 : 0;
}

function onTileClick(tile: GridTile) {
  if (tile.x === props.playerPos.x && tile.y === props.playerPos.y) return;
  emit('tileClick', tile.x, tile.y);
}

// --- Shared geometries & materials (created once, reused across tiles) ---
const tileGeometry = new THREE.BoxGeometry(0.88, 0.18, 0.88);
const shadowGeometry = new THREE.CircleGeometry(0.32, 16);
const tokenBodyGeometry = new THREE.CapsuleGeometry(0.22, 0.32, 4, 8);
const tokenHeadGeometry = new THREE.ConeGeometry(0.17, 0.32, 8);

// Chest prop: basicchest.glb, a rigged model whose lid is a SkinnedMesh
// driven by a single hinge bone ("Bone_1"). Loaded once per component
// instance; each chest tile gets its own SkeletonUtils clone -- a plain
// THREE.Object3D.clone(true) does NOT duplicate a skinned mesh's skeleton
// (all clones would keep sharing and fighting over the same bone objects).
const { state: chestGltf } = useGLTF('/models/basicchest.glb');
const CHEST_SCALE = 0.27;
const FLOOR_TOP = 0.09; // tileGeometry height / 2
// The model's authored bounding box sits ~0.049 units below its own origin;
// offset the group so the chest's bottom lands exactly on the floor surface.
const CHEST_GROUP_Y = FLOOR_TOP + 0.04925 * CHEST_SCALE;
// Relative hinge rotation that swings the lid up and back and away from the
// chest body -- verified against the model's actual skin weights; positive
// values instead rotate the lid down into the body.
const CHEST_LID_OPEN_ANGLE = -1.1;

// Cached per tile key so re-renders (triggered on every player move) reuse
// the existing clone instead of re-cloning the GLTF scene each time; only
// rebuilt when that tile's kind actually changes (CHEST -> CHEST_OPENED).
const chestObjectCache = new Map<string, { kind: TileKind; object: THREE.Object3D }>();

function buildChestObject(kind: TileKind): THREE.Object3D {
  const clone = SkeletonUtils.clone(chestGltf.value!.scene) as THREE.Object3D;
  if (kind === 'CHEST_OPENED') {
    clone.getObjectByName('Bone_1')?.rotateX(CHEST_LID_OPEN_ANGLE);
    // Darkened to read as emptied, matching the old procedural chest's look.
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = (child.material as THREE.MeshStandardMaterial).clone();
      material.color.multiplyScalar(0.45);
      child.material = material;
    });
  }
  return clone;
}

function chestObjectFor(tile: GridTile): THREE.Object3D | null {
  if (!chestGltf.value) return null;
  const key = cellKey(tile.x, tile.y);
  const cached = chestObjectCache.get(key);
  if (cached && cached.kind === tile.kind) return cached.object;
  const object = buildChestObject(tile.kind);
  chestObjectCache.set(key, { kind: tile.kind, object });
  return object;
}

const chestProps = computed(() =>
  chestTiles.value.map((tile) => ({ tile, object: chestObjectFor(tile) })).filter((entry): entry is { tile: GridTile; object: THREE.Object3D } => entry.object !== null),
);

// --- Cave rocks (sparse/rift maps only) ---
// rocks.glb is a whole rock pack; we pull a hand-picked spread of boulder
// meshes out of it and scatter them over every solid cell that touches an
// explored tile. Fog cells are real (unexplored) tiles, so the rock ring
// naturally stops at the exploration frontier.
const { state: rocksGltf } = useGLTF('/models/rocks.glb');

// Underscore-only names survive GLTFLoader's node-name sanitization.
const ROCK_VARIANT_NAMES = ['rock_md_01_Rocks_0', 'rock_md_02_Rocks_0', 'rock_md_03_Rocks_0', 'rock_md_04_Rocks_0', 'rock_md_05_Rocks_0', 'rock_sm2_01_Rocks_0', 'rock_sm2_03_Rocks_0', 'rock_sm2_04_Rocks_0'];

// One shared material for every rock, darkened so the walls recede behind
// the lit floor tiles instead of competing with them.
let rockMaterial: THREE.MeshStandardMaterial | null = null;

interface RockTemplate {
  geometry: THREE.BufferGeometry;
  center: THREE.Vector3; // horizontal bbox center, in raw geometry units
  bottom: number; // bbox min y, in raw geometry units
  footprint: number; // max horizontal bbox extent, in raw geometry units
}

const rockTemplates = computed<RockTemplate[]>(() => {
  const gltf = rocksGltf.value;
  if (!gltf) return [];
  const templates: RockTemplate[] = [];
  for (const name of ROCK_VARIANT_NAMES) {
    const mesh = gltf.scene.getObjectByName(name);
    if (!(mesh instanceof THREE.Mesh)) continue;
    if (!rockMaterial) {
      rockMaterial = (mesh.material as THREE.MeshStandardMaterial).clone();
      rockMaterial.color.multiplyScalar(0.72);
      rockMaterial.roughness = 0.95;
    }
    const geometry = mesh.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    templates.push({
      geometry,
      center: new THREE.Vector3((bb.min.x + bb.max.x) / 2, 0, (bb.min.z + bb.max.z) / 2),
      bottom: bb.min.y,
      footprint: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z),
    });
  }
  return templates;
});

// Every empty 8-neighbour of a rendered tile is solid rock. Cells just
// outside the grid bounds are included on purpose — they frame the map edge.
const rockCells = computed<{ x: number; y: number }[]>(() => {
  if (!props.sparse) return [];
  const occupied = new Set(props.tiles.map((t) => cellKey(t.x, t.y)));
  const seen = new Set<string>();
  const cells: { x: number; y: number }[] = [];
  for (const t of props.tiles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = t.x + dx;
        const y = t.y + dy;
        const key = cellKey(x, y);
        if (occupied.has(key) || seen.has(key)) continue;
        seen.add(key);
        cells.push({ x, y });
      }
    }
  }
  return cells;
});

// Deterministic per-cell randomness (variant, rotation, scale) so the same
// cell always grows the same rock across re-renders and revisits.
function rockRand(x: number, y: number, salt: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function buildRockObject(x: number, y: number, templates: RockTemplate[]): THREE.Object3D {
  const group = new THREE.Group();
  // Every rock cell gets one boulder sized to slightly overlap its
  // neighbours (a continuous wall); ~1 in 4 also gets a small companion.
  const count = rockRand(x, y, 9) > 0.75 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const template = templates[Math.floor(rockRand(x, y, 1 + i * 3) * templates.length)];
    const footprint = i === 0 ? 1.0 + rockRand(x, y, 2) * 0.25 : 0.3 + rockRand(x, y, 5) * 0.2;
    const scale = footprint / template.footprint;

    const mesh = new THREE.Mesh(template.geometry, rockMaterial!);
    mesh.raycast = () => {}; // never intercept tile clicks/hovers
    // Offset so the boulder spins around its own center and sits on the floor.
    mesh.position.set(-template.center.x, -template.bottom, -template.center.z);

    const wrapper = new THREE.Group();
    wrapper.add(mesh);
    wrapper.scale.setScalar(scale);
    wrapper.rotation.y = rockRand(x, y, 3 + i) * Math.PI * 2;
    const jitter = i === 0 ? 0 : 0.5;
    wrapper.position.set(worldX(x) + (rockRand(x, y, 6 + i) - 0.5) * jitter, -0.05, worldZ(y) + (rockRand(x, y, 7 + i) - 0.5) * jitter);
    group.add(wrapper);
  }
  return group;
}

// Cached per cell — solid cells never change once revealed, so re-renders on
// every player move reuse the built group instead of re-cloning meshes.
const rockObjectCache = new Map<string, THREE.Object3D>();

const rockProps = computed(() => {
  const templates = rockTemplates.value;
  if (!templates.length) return [];
  return rockCells.value.map(({ x, y }) => {
    const key = cellKey(x, y);
    let object = rockObjectCache.get(key);
    if (!object) {
      object = buildRockObject(x, y, templates);
      rockObjectCache.set(key, object);
    }
    return { key, object };
  });
});

// Boss marker: a small campfire cluster (outer + two inner flame cones),
// scaled by fireFlicker for a flame-like animation, lighting the arena via
// the accompanying TresPointLight.
const fireOuterGeometry = new THREE.ConeGeometry(0.16, 0.34, 6);
const fireInnerGeometry = new THREE.ConeGeometry(0.1, 0.24, 6);
const fireOuterMaterial = new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4400', emissiveIntensity: 1.1, roughness: 0.3 });
const fireInnerMaterial = new THREE.MeshStandardMaterial({ color: '#ffb03d', emissive: '#ff8400', emissiveIntensity: 1.2, roughness: 0.3 });
const fireCoreMaterial = new THREE.MeshStandardMaterial({ color: '#ffe23d', emissive: '#ffc400', emissiveIntensity: 1.5, roughness: 0.3 });

const tileColors: Record<TileKind, string> = {
  EMPTY: '#333a48',
  SAFE: '#3fae5c',
  SHOP: '#d4af37',
  LOOT_SHOP: '#8e6bb0',
  FORGE: '#c2571f',
  DANGER: '#b3403d',
  LOCATION: '#4fa8e0',
  LOCATION_LOCKED: '#565c68',
  RIFT: '#9c4fe0',
  RIFT_LOCKED: '#5c4a68',
  FOG: '#161a24',
  PATH: '#3d4456',
  ENTRANCE: '#3fae5c',
  MONSTER: '#a33d6b',
  BOSS: '#5a0f1f',
  RESOURCE: '#2f9e83',
  RESOURCE_EMPTY: '#2c4640',
  CHEST: '#7a5a2a',
  CHEST_OPENED: '#3a3226',
  LOCKED: '#c07830',
  DARK: '#4a3f66',
};

const tileMaterials: Record<TileKind, THREE.MeshStandardMaterial> = Object.fromEntries(
  Object.entries(tileColors).map(([kind, color]) => [kind, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 })]),
) as Record<TileKind, THREE.MeshStandardMaterial>;
// Fog frontier reads as "something is there, but unseen".
tileMaterials.FOG.transparent = true;
tileMaterials.FOG.opacity = 0.55;

function tileMaterial(tile: GridTile) {
  return tileMaterials[tile.kind];
}

const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35 });
const tokenBodyMaterial = new THREE.MeshStandardMaterial({ color: '#ff6b3d', roughness: 0.5 });
const tokenHeadMaterial = new THREE.MeshStandardMaterial({ color: '#ffd23d', roughness: 0.4 });

// --- Character token position + walking animation ---
const tokenPos = reactive({ x: worldX(props.playerPos.x), y: 0, z: worldZ(props.playerPos.y) });
let initialized = false;

function animateTokenTo(x: number, z: number) {
  const tl = gsap.timeline();
  tl.to(tokenPos, { y: 0.4, duration: 0.14, ease: 'power1.out' }, 0);
  tl.to(tokenPos, { x, z, duration: 0.32, ease: 'power1.inOut' }, 0.04);
  tl.to(tokenPos, { y: 0, duration: 0.14, ease: 'power1.in' }, 0.32);
}

watch(
  () => [props.playerPos.x, props.playerPos.y],
  ([x, y]) => {
    const targetX = worldX(x);
    const targetZ = worldZ(y);
    if (!initialized) {
      tokenPos.x = targetX;
      tokenPos.z = targetZ;
      initialized = true;
      return;
    }
    animateTokenTo(targetX, targetZ);
  },
  { immediate: true },
);
</script>

<style scoped>
.grid-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
}

.tile-label {
  pointer-events: none;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: #fff;
  background: rgba(10, 12, 18, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.tile-label.safe {
  border-color: #3fae5c;
}
.tile-label.shop {
  border-color: #d4af37;
}
.tile-label.loot_shop {
  border-color: #8e6bb0;
}
.tile-label.forge {
  border-color: #c2571f;
}
.tile-label.danger {
  border-color: #b3403d;
}
.tile-label.location,
.tile-label.location_locked {
  border-color: #4fa8e0;
}
.tile-label.rift,
.tile-label.rift_locked {
  border-color: #9c4fe0;
}
.tile-label.entrance {
  border-color: #3fae5c;
}
.tile-label.monster {
  border-color: #a33d6b;
}
.tile-label.boss {
  border-color: #c81e3a;
  font-weight: 800;
}
.tile-label.resource {
  border-color: #2f9e83;
}
.tile-label.resource_empty {
  border-color: #2c4640;
}
.tile-label.chest {
  border-color: #d4af37;
}
.tile-label.chest_opened {
  border-color: #5a4a2a;
}
.tile-label.locked {
  border-color: #c07830;
}
.tile-label.dark {
  border-color: #4a3f66;
}
.tile-label.path {
  border-color: rgba(255, 255, 255, 0.25);
}
</style>
