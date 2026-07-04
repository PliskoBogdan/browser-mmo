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

      <div v-if="battleResult.lootDrops?.length" class="mb-4">
        <div class="text-caption text-medium-emphasis mb-2">Loot found:</div>
        <div class="d-flex flex-wrap justify-center" style="gap: 8px">
          <v-chip v-for="drop in battleResult.lootDrops" :key="drop.name" :color="rarityColor(drop.rarity)" variant="tonal" prepend-icon="mdi-cube-outline">
            {{ drop.name }} x{{ drop.quantity }}
          </v-chip>
        </div>
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
    let msg = `Victory! You defeated the monster and gained ${props.battleResult.expGained} EXP and ${props.battleResult.goldGained} Gold.`;
    if (props.battleResult.leveledUp) {
      msg += " Level Up!";
      if (props.battleResult.statPointsGained) msg += ` +${props.battleResult.statPointsGained} stat points.`;
      if (props.battleResult.perkPointsGained) msg += ` +${props.battleResult.perkPointsGained} perk point.`;
    }
    return msg;
  }

  if (
    props.battleResult.battleStatus === "LOST" ||
    props.battleResult.playerDied
  ) {
    return "You have been defeated...";
  }

  return "";
});

function rarityColor(rarity: "COMMON" | "UNCOMMON" | "RARE") {
  return { COMMON: "#9e9e9e", UNCOMMON: "#4caf50", RARE: "#ffab00" }[rarity];
}
</script>
