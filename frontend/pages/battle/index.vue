<template>
  <div>
    <div class="text-h5 font-weight-bold mb-6">
      <v-icon color="primary" class="mr-2">mdi-sword-cross</v-icon>
      Battle
    </div>

    <BattleResult 
        v-if="lastResult !== null && lastResult.battleStatus === 'WON'"
        :battleResult="lastResult"
    />

    <!-- No active battle -->
    <v-card v-else-if="!battle && !loading" elevation="4" class="text-center pa-8">
      <v-icon size="64" color="secondary" class="mb-4">mdi-sword-cross</v-icon>
      <div class="text-h6 mb-2">No active battle</div>
      <div class="text-body-2 text-medium-emphasis mb-4">Go to the World map and enter a dangerous zone</div>
      <v-btn color="primary" to="/world" prepend-icon="mdi-map">Go to World</v-btn>
    </v-card>

    <v-skeleton-loader v-else-if="loading" type="card, card" />

    <!-- Active battle -->
    <v-row v-else-if="battle">
      <!-- Monster -->
      <v-col cols="12" md="6">
        <v-card elevation="4" color="surface">
          <v-card-title class="text-error">
            <v-icon class="mr-2">mdi-skull</v-icon>
            {{ battle.monster.name }}
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-body-2 text-medium-emphasis">Monster HP</span>
              <span class="text-body-2 font-weight-bold text-error">{{ battle.monster.currentHp }} / {{ battle.monster.maxHp }}</span>
            </div>
            <v-progress-linear
              :model-value="(battle.monster.currentHp / battle.monster.maxHp) * 100"
              color="error"
              bg-color="surface-variant"
              height="12"
              rounded
              class="mb-4"
            />
            <v-row dense>
              <v-col cols="6">
                <v-list-item density="compact" prepend-icon="mdi-sword" title="Damage" :subtitle="String(battle.monster.damage)" />
              </v-col>
              <v-col cols="6">
                <v-list-item density="compact" prepend-icon="mdi-timer" title="Attack Speed" :subtitle="`${battle.monster.attackSpeed}/s`" />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Player + Controls -->
      <v-col cols="12" md="6">
        <v-card elevation="4" class="mb-4">
          <v-card-title>
            <v-icon class="mr-2" color="info">mdi-account</v-icon>
            Your Character
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-body-2 text-medium-emphasis">HP</span>
              <span class="text-body-2 font-weight-bold">{{ playerHp }} / {{ playerMaxHp }}</span>
            </div>
            <v-progress-linear
              :model-value="playerHp && playerMaxHp ? (playerHp / playerMaxHp) * 100 : 100"
              color="success"
              bg-color="surface-variant"
              height="12"
              rounded
            />
          </v-card-text>
        </v-card>

        <!-- Battle log -->
        <v-card v-if="lastResult" elevation="2" variant="tonal" class="mb-4" :color="resultColor">
          <v-card-text class="pa-3">
            <div class="text-body-2">
              <span class="font-weight-bold text-error">You dealt {{ lastResult.playerDamageDealt }} dmg</span>
              <span class="mx-2 text-medium-emphasis">·</span>
              <span class="font-weight-bold text-warning">Monster dealt {{ lastResult.monsterDamageDealt }} dmg</span>
            </div>
            <div v-if="lastResult.expGained || lastResult.goldGained" class="text-body-2 mt-1">
              <span v-if="lastResult.expGained" class="text-info mr-2">+{{ lastResult.expGained }} EXP</span>
              <span v-if="lastResult.goldGained" class="text-warning">+{{ lastResult.goldGained }} Gold</span>
              <span v-if="lastResult.leveledUp" class="text-success ml-2">⬆ Level Up!</span>
            </div>
          </v-card-text>
        </v-card>

        <!-- Actions -->
        <div class="d-flex gap-3">
          <v-btn
            color="primary"
            size="large"
            prepend-icon="mdi-sword"
            :loading="attacking"
            @click="handleAttack"
          >
            Attack
            <template v-if="!canAttack && cooldownRemaining > 0" #append>
              <span class="text-caption ml-1">({{ Math.ceil(cooldownRemaining / 100) / 10 }}s)</span>
            </template>
          </v-btn>

          <v-btn
            color="warning"
            size="large"
            variant="tonal"
            prepend-icon="mdi-run"
            :loading="fleeing"
            @click="handleFlee"
          >
            Flee
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const battleStore = useBattleStore();
const characterStore = useCharacterStore();
const { battle, lastResult, canAttack, cooldownRemaining } = storeToRefs(battleStore);

const loading = ref(false);
const attacking = ref(false);
const fleeing = ref(false);
const battleEndType = ref<'success' | 'error' | 'warning'>('success');

const playerHp = computed(() => lastResult.value?.playerCurrentHp ?? characterStore.character?.hp);
const playerMaxHp = computed(() => lastResult.value?.playerMaxHp ?? characterStore.character?.maxHp);

const resultColor = computed(() => {
  if (!lastResult.value) return undefined;
  if (lastResult.value.battleStatus === 'WON') return 'success';
  if (lastResult.value.battleStatus === 'LOST') return 'error';
  return undefined;
});

// Cooldown ticker to keep the button state reactive
let cooldownInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  loading.value = true;
  try {
    await battleStore.fetchCurrent();
    if (!characterStore.character) await characterStore.fetch();
  } finally {
    loading.value = false;
  }

  cooldownInterval = setInterval(() => {
    // triggers reactivity for cooldownRemaining
    battleStore.cooldownUntil = battleStore.cooldownUntil;
  }, 100);
});

onUnmounted(() => {
  if (cooldownInterval) clearInterval(cooldownInterval);
});

async function handleAttack() {
  attacking.value = true;
  try {
    const result = await battleStore.attack();

    if (result.battleStatus === 'WON') {
      battleEndType.value = 'success';
      await characterStore.fetch();
    } else if (result.battleStatus === 'LOST' || result.playerDied) {
      battleEndType.value = 'error';
      await characterStore.fetch();
    }
  } catch (e: any) {
    // 429 = cooldown still active — ignore
  } finally {
    attacking.value = false;
  }
}

async function handleFlee() {
  fleeing.value = true;
  try {
    const result = await battleStore.flee();
    battleEndType.value = 'warning';
    await characterStore.fetch();
  } finally {
    fleeing.value = false;
  }
}
</script>
