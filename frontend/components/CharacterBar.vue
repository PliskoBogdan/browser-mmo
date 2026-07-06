<template>
  <v-app-bar :elevation="2">
    <div class="character-bar">
      <div class="progress-bar__wrapper">
        <span class="progress-bar__level">LVL: {{ character?.level }}</span>
        <v-progress-linear
          :model-value="character ? (character.hp / character.maxHp) * 100 : 0"
          color="error"
          bg-color="surface"
          height="20"
          rounded
        />
      </div>
      <div class="progress-bar__wrapper">
        <span class="progress-bar__level">STA: {{ character?.stamina }} / {{ character?.maxStamina }}</span>
        <v-progress-linear
          :model-value="character ? (character.stamina / character.maxStamina) * 100 : 0"
          color="green"
          bg-color="surface"
          height="20"
          rounded
        />
      </div>
      <div class="progress-bar__wrapper">
          <span class="progress-bar__level progress-bar__level--exp">EXP: {{ character?.exp }} / {{ character?.expToNextLevel }}</span>
          <v-progress-linear
            :model-value="
              character ? (character.exp / character.expToNextLevel) * 100 : 0
            "
            color="yellow"
            bg-color="surface"
            height="20"
            rounded
          />
      </div>
    </div>
  </v-app-bar>
</template>

<script lang="ts" setup>
import { type Character } from "@/stores/character";

const props = defineProps<{
  character: Character | null;
}>();
</script>

<style scoped>
.character-bar {
  width: 100%;
  padding: 4px 0;
}
.progress-bar__wrapper {
    position: relative;
}
.progress-bar__level {
  position: absolute;
  top: 0;
  z-index: 3;
  left: 50%;
  font-size: 14px;
  bottom: 6px;
}
.progress-bar__level--exp {
    color: black;
}
</style>
