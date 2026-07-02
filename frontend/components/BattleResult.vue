<template>
  <v-card elevation="4" class="text-center pa-8">
    <h2 class="mb-2">{{ battleResultMessage }}</h2>
    <div>
      <v-icon size="64" color="secondary" class="mb-4">mdi-sword-cross</v-icon>
      <div class="text-h6 mb-2">No active battle</div>
      <div
        v-if="!battleResultMessage"
        class="text-body-2 text-medium-emphasis mb-4"
      >
        Go to the World map and enter a dangerous zone
      </div>
      <v-btn color="primary" to="/world" prepend-icon="mdi-map"
        >Go to World</v-btn
      >
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { type AttackResult } from "@/stores/battle";

const props = defineProps<{
  battleResult: AttackResult;
}>();

const battleResultMessage = computed<string>(() => {
  if (props.battleResult.battleStatus === "WON") {
    return `Victory! You defeated the monster and gained ${props.battleResult.expGained} EXP and ${props.battleResult.goldGained} Gold.${props.battleResult.leveledUp ? " Level Up!" : ""}`;
  }

  if (
    props.battleResult.battleStatus === "LOST" ||
    props.battleResult.playerDied
  ) {
    return "You have been defeated...";
  }

  return "";
});
</script>
