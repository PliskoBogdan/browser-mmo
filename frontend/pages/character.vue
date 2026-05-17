<template>
  <div>
    <div class="text-h5 font-weight-bold mb-6">
      <v-icon color="primary" class="mr-2">mdi-account</v-icon>
      Character
    </div>

    <v-row v-if="character">
      <!-- Stats -->
      <v-col cols="12" md="6">
        <v-card elevation="4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="accent">mdi-account-circle</v-icon>
            {{ character.username }}
            <v-chip v-if="character.isDead" color="error" size="small" class="ml-2">Dead</v-chip>
          </v-card-title>

          <v-card-text>
            <div class="mb-4">
              <div class="d-flex justify-space-between mb-1">
                <span class="text-body-2 text-medium-emphasis">HP</span>
                <span class="text-body-2 font-weight-bold">{{ character.hp }} / {{ character.maxHp }}</span>
              </div>
              <v-progress-linear
                :model-value="(character.hp / character.maxHp) * 100"
                color="error"
                bg-color="surface"
                height="10"
                rounded
              />
            </div>

            <div class="mb-4">
              <div class="d-flex justify-space-between mb-1">
                <span class="text-body-2 text-medium-emphasis">EXP</span>
                <span class="text-body-2 font-weight-bold">{{ character.exp }} / {{ character.expToNextLevel }}</span>
              </div>
              <v-progress-linear
                :model-value="(character.exp / character.expToNextLevel) * 100"
                color="info"
                bg-color="surface"
                height="10"
                rounded
              />
            </div>

            <v-row dense>
              <v-col cols="6">
                <v-list-item density="compact" prepend-icon="mdi-star" title="Level" :subtitle="String(character.level)" />
              </v-col>
              <v-col cols="6">
                <v-list-item density="compact" prepend-icon="mdi-gold" title="Gold" :subtitle="String(character.gold)" />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions v-if="character.isDead" class="pa-4 pt-0">
            <v-btn color="success" variant="tonal" prepend-icon="mdi-heart" :loading="resurrecting" @click="handleResurrect">
              Resurrect
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Equipment -->
      <v-col cols="12" md="6">
        <v-card elevation="4">
          <v-card-title>
            <v-icon class="mr-2" color="accent">mdi-sword</v-icon>
            Equipment
          </v-card-title>

          <v-card-text>
            <div class="mb-4">
              <div class="text-overline text-medium-emphasis mb-2">Primary Weapon</div>
              <v-card v-if="character.equipment?.primaryWeapon" variant="tonal" color="primary">
                <v-card-text class="pa-3">
                  <div class="font-weight-bold">{{ character.equipment.primaryWeapon.name }}</div>
                  <v-row dense class="mt-1">
                    <v-col cols="6">
                      <span class="text-caption text-medium-emphasis">Damage</span>
                      <div class="text-body-2 font-weight-bold text-error">{{ character.equipment.primaryWeapon.damage }}</div>
                    </v-col>
                    <v-col cols="6">
                      <span class="text-caption text-medium-emphasis">Cooldown</span>
                      <div class="text-body-2 font-weight-bold text-info">{{ character.attackCooldownMs }}ms</div>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
              <v-card v-else variant="outlined" class="pa-3 text-center text-medium-emphasis">
                <v-icon>mdi-sword-off</v-icon> Empty slot
              </v-card>
            </div>

            <div>
              <div class="text-overline text-medium-emphasis mb-2">Secondary Weapon</div>
              <v-card v-if="character.equipment?.secondaryWeapon" variant="tonal" color="secondary">
                <v-card-text class="pa-3">
                  <div class="font-weight-bold">{{ character.equipment.secondaryWeapon.name }}</div>
                </v-card-text>
              </v-card>
              <v-card v-else variant="outlined" class="pa-3 text-center text-medium-emphasis">
                <v-icon>mdi-sword-off</v-icon> Empty slot
              </v-card>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-skeleton-loader v-else-if="characterStore.loading" type="card, card" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const characterStore = useCharacterStore();
const { character } = storeToRefs(characterStore);

const resurrecting = ref(false);

onMounted(() => characterStore.fetch());

async function handleResurrect() {
  resurrecting.value = true;
  try {
    await characterStore.resurrect();
  } finally {
    resurrecting.value = false;
  }
}
</script>
