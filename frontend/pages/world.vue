<template>
  <div>
    <div class="text-h5 font-weight-bold mb-6">
      <v-icon color="primary" class="mr-2">mdi-map</v-icon>
      World
    </div>

    <v-alert v-if="enterError" type="error" variant="tonal" class="mb-4" density="compact" closable @click:close="enterError = ''">
      {{ enterError }}
    </v-alert>

    <v-row v-if="!worldStore.loading">
      <v-col v-for="location in locations" :key="location.id" cols="12" md="6" lg="4">
        <v-card elevation="4" height="100%">
          <v-card-title>
            <v-icon color="accent" class="mr-2">mdi-map-marker</v-icon>
            {{ location.name }}
            <v-chip size="x-small" class="ml-2" color="info">Lv {{ location.minLevel }}+</v-chip>
          </v-card-title>

          <v-card-subtitle v-if="location.description" class="pt-1 pb-3">
            {{ location.description }}
          </v-card-subtitle>

          <v-divider />

          <v-list density="compact">
            <v-list-item
              v-for="sub in location.subLocations"
              :key="sub.id"
              :subtitle="sub.description ?? undefined"
              rounded="lg"
              class="ma-1"
            >
              <template #title>
                <div class="d-flex align-center gap-2">
                  <v-icon size="16" :color="sub.isSafe ? 'success' : 'error'">
                    {{ sub.isSafe ? 'mdi-shield-check' : 'mdi-sword-cross' }}
                  </v-icon>
                  <span>{{ sub.name }}</span>
                  <v-chip size="x-small" color="secondary">Lv {{ sub.minLevel }}+</v-chip>
                </div>
              </template>

              <template v-if="!sub.isSafe && sub.monsters.length" #append>
                <v-btn
                  size="small"
                  color="primary"
                  variant="tonal"
                  :loading="enteringId === sub.id"
                  @click="handleEnter(sub.id)"
                >
                  Enter
                </v-btn>
              </template>

              <template v-else-if="sub.isSafe" #append>
                <v-chip size="x-small" color="success" variant="tonal">Safe</v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col v-for="i in 3" :key="i" cols="12" md="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const worldStore = useWorldStore();
const battleStore = useBattleStore();
const { locations } = storeToRefs(worldStore);

const enteringId = ref<number | null>(null);
const enterError = ref('');

onMounted(() => worldStore.fetchLocations());

async function handleEnter(subLocationId: number) {
  enteringId.value = subLocationId;
  enterError.value = '';
  try {
    const result = await battleStore.enter(subLocationId);
    if (!result.isSafe && battleStore.battle) {
      await navigateTo('/battle');
    }
  } catch (e: any) {
    enterError.value = e?.data?.message ?? 'Failed to enter location';
  } finally {
    enteringId.value = null;
  }
}
</script>
