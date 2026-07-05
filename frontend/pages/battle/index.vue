<template>
  <div>
    <div class="text-h5 font-weight-bold mb-6">
      <v-icon color="primary" class="mr-2">mdi-sword-cross</v-icon>
      Battle
    </div>

    <BattleResult
        v-if="lastResult !== null && lastResult.battleStatus !== 'ACTIVE' && !battle"
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
              class="mb-2"
            />

            <!-- Monster statuses -->
            <div v-if="monsterStatuses.length" class="d-flex flex-wrap ga-1 mb-3">
              <v-chip
                v-for="status in monsterStatuses"
                :key="status.code"
                size="small"
                :color="status.kind === 'BUFF' ? 'success' : 'deep-orange'"
                variant="tonal"
              >
                <v-icon start size="14">{{ status.icon }}</v-icon>
                {{ status.name }}<span v-if="status.stacks > 1" class="ml-1">×{{ status.stacks }}</span>
                <v-tooltip activator="parent" location="top">{{ status.description }}</v-tooltip>
              </v-chip>
            </div>

            <!-- Intent: what the monster will do next -->
            <v-alert
              v-if="intent"
              density="compact"
              variant="tonal"
              :color="intent.kind === 'HEAVY' ? 'error' : intent.kind === 'DEFEND' ? 'info' : 'warning'"
              class="mb-3"
            >
              <template #prepend>
                <v-icon>{{ intent.icon }}</v-icon>
              </template>
              <span class="text-body-2 font-weight-bold">{{ intent.label }}</span>
              <span v-if="intent.estimatedDamage" class="text-body-2 ml-1">(~{{ intent.estimatedDamage }} dmg)</span>
            </v-alert>

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

        <!-- Battle log -->
        <v-card elevation="2" class="mt-4">
          <v-card-title class="text-body-1">
            <v-icon class="mr-2" size="20">mdi-script-text</v-icon>
            Battle Log
          </v-card-title>
          <v-card-text ref="logContainer" class="battle-log pa-3">
            <div v-if="!log.length" class="text-body-2 text-medium-emphasis">Choose a skill to begin...</div>
            <div v-for="(event, i) in log" :key="i" class="text-body-2 mb-1" :class="toneClass(event.tone)">
              {{ event.text }}
            </div>
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
              class="mb-2"
            />

            <!-- Player statuses -->
            <div v-if="playerStatuses.length" class="d-flex flex-wrap ga-1 mb-3">
              <v-chip
                v-for="status in playerStatuses"
                :key="status.code"
                size="small"
                :color="status.kind === 'BUFF' ? 'success' : 'deep-orange'"
                variant="tonal"
              >
                <v-icon start size="14">{{ status.icon }}</v-icon>
                {{ status.name }}<span v-if="status.stacks > 1" class="ml-1">×{{ status.stacks }}</span>
                <v-tooltip activator="parent" location="top">{{ status.description }}</v-tooltip>
              </v-chip>
            </div>

            <!-- Momentum -->
            <div class="d-flex align-center mt-2">
              <span class="text-body-2 text-medium-emphasis mr-3">Momentum</span>
              <v-icon
                v-for="i in state?.maxMomentum ?? 5"
                :key="i"
                size="18"
                class="mr-1"
                :color="i <= (state?.momentum ?? 0) ? 'amber' : 'surface-variant'"
              >
                {{ i <= (state?.momentum ?? 0) ? 'mdi-circle' : 'mdi-circle-outline' }}
              </v-icon>
            </div>
          </v-card-text>
        </v-card>

        <!-- Skills -->
        <v-card elevation="4" class="mb-4">
          <v-card-title class="text-body-1">
            <v-icon class="mr-2" size="20">mdi-flash</v-icon>
            Skills
          </v-card-title>
          <v-card-text class="pt-1">
            <v-row dense>
              <v-col v-for="skill in skills" :key="skill.code" cols="6">
                <v-btn
                  block
                  size="large"
                  :color="skill.momentumCost > 0 ? 'amber-darken-2' : 'primary'"
                  :variant="skillUsable(skill) ? 'flat' : 'tonal'"
                  :disabled="!skillUsable(skill) || attacking"
                  class="skill-btn"
                  @click="handleSkill(skill.code)"
                >
                  <v-icon start>{{ skill.icon }}</v-icon>
                  <span class="text-truncate">{{ skill.name }}</span>
                  <span v-if="skill.momentumCost > 0" class="text-caption ml-1">({{ skill.momentumCost }}◆)</span>
                  <span v-else-if="skillCooldownText(skill)" class="text-caption ml-1">{{ skillCooldownText(skill) }}</span>
                  <v-tooltip activator="parent" location="top" max-width="260">{{ skill.description }}</v-tooltip>
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Actions -->
        <div class="d-flex gap-3">
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
import type { CombatEventTone, SkillView } from '~/stores/battle';

definePageMeta({ middleware: 'auth' });

const battleStore = useBattleStore();
const characterStore = useCharacterStore();
const worldStore = useWorldStore();
const { battle, state, log, lastResult, skillCooldownUntil, cooldownUntil } = storeToRefs(battleStore);

const loading = ref(false);
const attacking = ref(false);
const fleeing = ref(false);
const battleEndType = ref<'success' | 'error' | 'warning'>('success');

// Reactive clock so cooldown countdowns tick without store hacks.
const now = ref(Date.now());
let clockInterval: ReturnType<typeof setInterval> | null = null;

const playerHp = computed(() => lastResult.value?.playerCurrentHp ?? characterStore.character?.hp);
const playerMaxHp = computed(() => lastResult.value?.playerMaxHp ?? characterStore.character?.maxHp);

const skills = computed(() => state.value?.skills ?? []);
const intent = computed(() => state.value?.intent ?? null);
const playerStatuses = computed(() => state.value?.playerStatuses ?? []);
const monsterStatuses = computed(() => state.value?.monsterStatuses ?? []);

function skillRemainingMs(skill: SkillView): number {
  const perSkill = Math.max(0, (skillCooldownUntil.value[skill.code] ?? 0) - now.value);
  const global = Math.max(0, cooldownUntil.value - now.value);
  return Math.max(perSkill, global);
}

function skillUsable(skill: SkillView): boolean {
  if (!battle.value) return false;
  if (skillRemainingMs(skill) > 0) return false;
  return (state.value?.momentum ?? 0) >= skill.momentumCost;
}

function skillCooldownText(skill: SkillView): string | null {
  const ms = skillRemainingMs(skill);
  if (ms <= 0) return null;
  return `${(Math.ceil(ms / 100) / 10).toFixed(1)}s`;
}

function toneClass(tone: CombatEventTone): string {
  switch (tone) {
    case 'crit': return 'text-warning font-weight-bold';
    case 'player-hit': return 'text-error';
    case 'monster-hit': return 'text-deep-orange';
    case 'heal': return 'text-success';
    case 'status': return 'text-info';
    default: return 'text-medium-emphasis';
  }
}

const logContainer = ref<{ $el: HTMLElement } | null>(null);

watch(
  () => log.value.length,
  async () => {
    await nextTick();
    const el = logContainer.value?.$el;
    if (el) el.scrollTop = el.scrollHeight;
  },
);

onMounted(async () => {
  loading.value = true;
  try {
    await battleStore.fetchCurrent();
    if (!characterStore.character) await characterStore.fetch();
  } finally {
    loading.value = false;
  }

  clockInterval = setInterval(() => {
    now.value = Date.now();
  }, 100);
});

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
});

async function handleSkill(skillCode: string) {
  attacking.value = true;
  try {
    const result = await battleStore.useSkill(skillCode);

    if (result.battleStatus === 'WON') {
      battleEndType.value = 'success';
      if (result.newPosition) {
        worldStore.hydratePosition({ locationId: worldStore.position.locationId, x: result.newPosition.x, y: result.newPosition.y });
      }
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
  const wasRiftBattle = battle.value?.riftBattle ?? false;
  fleeing.value = true;
  try {
    await battleStore.flee();
    battleEndType.value = 'warning';
    await characterStore.fetch();
    // Fleeing a rift fight drops you back at the rift entrance — return there.
    if (wasRiftBattle) {
      const riftStore = useRiftStore();
      const run = await riftStore.fetchCurrent();
      await navigateTo(run ? `/rifts/${run.id}` : '/world');
    }
  } finally {
    fleeing.value = false;
  }
}
</script>

<style scoped>
.battle-log {
  max-height: 260px;
  overflow-y: auto;
}

.skill-btn {
  justify-content: flex-start;
}
</style>
