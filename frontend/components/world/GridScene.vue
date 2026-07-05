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
import { TresCanvas } from '@tresjs/core';
import { OrbitControls, Html } from '@tresjs/cientos';
import gsap from 'gsap';

export type TileKind = 'EMPTY' | 'SAFE' | 'SHOP' | 'LOOT_SHOP' | 'DANGER' | 'LOCATION' | 'LOCATION_LOCKED';

export interface GridTile {
  x: number;
  y: number;
  kind: TileKind;
  label?: string;
  locked?: boolean;
}

const props = defineProps<{
  width: number;
  height: number;
  tiles: GridTile[];
  playerPos: { x: number; y: number };
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

const tileColors: Record<TileKind, string> = {
  EMPTY: '#333a48',
  SAFE: '#3fae5c',
  SHOP: '#d4af37',
  LOOT_SHOP: '#8e6bb0',
  DANGER: '#b3403d',
  LOCATION: '#4fa8e0',
  LOCATION_LOCKED: '#565c68',
};

const tileMaterials: Record<TileKind, THREE.MeshStandardMaterial> = Object.fromEntries(
  Object.entries(tileColors).map(([kind, color]) => [kind, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 })]),
) as Record<TileKind, THREE.MeshStandardMaterial>;

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
.tile-label.danger {
  border-color: #b3403d;
}
.tile-label.location,
.tile-label.location_locked {
  border-color: #4fa8e0;
}
</style>
