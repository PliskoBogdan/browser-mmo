<template>
  <v-card elevation="4" class="text-center pa-8">
    <v-icon size="64" :color="isDeath ? 'error' : 'secondary'" class="mb-4">
      {{ isDeath ? "mdi-skull-crossbones" : "mdi-sword-cross" }}
    </v-icon>
    <h2 class="mb-2">{{ battleResultMessage }}</h2>

    <div v-if="bankedDrops.length" class="mb-4">
      <div class="text-caption text-medium-emphasis mb-2">Added to inventory:</div>
      <div class="d-flex flex-wrap justify-center" style="gap: 8px">
        <v-chip v-for="drop in bankedDrops" :key="drop.name" :color="rarityColor(drop.rarity)" variant="tonal" prepend-icon="mdi-cube-outline">
          {{ drop.name }} x{{ drop.quantity }}
        </v-chip>
      </div>
    </div>

    <div v-if="bagDrops.length" class="mb-4">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ battleResult.riftBattle ? "Added to your rift bag (extract to keep it):" : "Loot found:" }}
      </div>
      <div class="d-flex flex-wrap justify-center" style="gap: 8px">
        <v-chip v-for="drop in bagDrops" :key="drop.name" :color="rarityColor(drop.rarity)" variant="tonal" prepend-icon="mdi-cube-outline">
          {{ drop.name }} x{{ drop.quantity }}
        </v-chip>
      </div>
    </div>

    <div v-if="battleResult.lostLoot?.length" class="mb-4">
      <div class="text-caption text-error mb-2">Lost from your rift bag:</div>
      <div class="d-flex flex-wrap justify-center" style="gap: 8px">
        <v-chip v-for="drop in battleResult.lostLoot" :key="drop.name" color="error" variant="tonal" prepend-icon="mdi-close-circle-outline">
          {{ drop.name }} x{{ drop.quantity }}
        </v-chip>
      </div>
    </div>

    <v-btn v-if="isDeath" color="error" variant="flat" to="/character" prepend-icon="mdi-heart-broken">Go Resurrect</v-btn>
    <v-btn v-else-if="battleResult.riftBattle" color="primary" prepend-icon="mdi-orbit-variant" :loading="returning" @click="returnToRift">
      Return to Rift
    </v-btn>
    <v-btn v-else color="primary" to="/world" prepend-icon="mdi-map">Go to World</v-btn>
  </v-card>
</template>

<script setup lang="ts">
import { type AttackResult } from "@/stores/battle";

const props = defineProps<{
  battleResult: AttackResult;
}>();

const riftStore = useRiftStore();
const returning = ref(false);

const isDeath = computed(() => props.battleResult.battleStatus === "LOST" || props.battleResult.playerDied);
const bankedDrops = computed(() => props.battleResult.lootDrops?.filter((d) => d.banked) ?? []);
const bagDrops = computed(() => props.battleResult.lootDrops?.filter((d) => !d.banked) ?? []);

async function returnToRift() {
  returning.value = true;
  try {
    const run = await riftStore.fetchCurrent();
    await navigateTo(run ? `/rifts/${run.id}` : "/world");
  } finally {
    returning.value = false;
  }
}

const battleResultMessage = computed<string>(() => {
  if (isDeath.value) return "You have been defeated...";

  let msg = `Victory! You defeated the monster and gained ${props.battleResult.expGained} EXP and ${props.battleResult.goldGained} Gold.`;
  if (props.battleResult.leveledUp) {
    msg += " Level Up!";
    if (props.battleResult.statPointsGained) msg += ` +${props.battleResult.statPointsGained} stat points.`;
    if (props.battleResult.perkPointsGained) msg += ` +${props.battleResult.perkPointsGained} perk point.`;
  }
  return msg;
});

function rarityColor(rarity: "COMMON" | "UNCOMMON" | "RARE") {
  return { COMMON: "#9e9e9e", UNCOMMON: "#4caf50", RARE: "#ffab00" }[rarity];
}
</script>
