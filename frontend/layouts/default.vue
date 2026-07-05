<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list-item prepend-icon="mdi-skull-crossbones" title="MMO RPG" nav>
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            @click="rail = !rail"
          />
        </template>
      </v-list-item>

      <v-divider />

      <v-list density="compact" nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          :active="route.path === item.to || route.path.startsWith(item.to + '/')"
          color="primary"
          rounded="lg"
        />
      </v-list>

      <template #append>
        <v-divider />
        <v-list density="compact" nav class="mb-2">
          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            rounded="lg"
            @click="handleLogout"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-main>
      <v-progress-linear
        :model-value="character ? (character.hp / character.maxHp) * 100 : 0"
        color="error"
        bg-color="surface"
        height="10"
        rounded
      />
      <v-container fluid class="pa-6">
        <slot />
      </v-container>
    </v-main>

    <InventoryWindow />
  </v-app>
</template>

<script setup lang="ts">
const route = useRoute();
const authStore = useAuthStore();
const characterStore = useCharacterStore();
const battleStore = useBattleStore();
const worldStore = useWorldStore();
const inventoryStore = useInventoryStore();
const riftStore = useRiftStore();

const { character } = storeToRefs(characterStore);

onMounted(() => characterStore.fetch());

const drawer = ref(true);
const rail = ref(false);

const navItems = [
  { title: "Character", icon: "mdi-account", to: "/character" },
  { title: "World", icon: "mdi-map", to: "/world" },
  { title: "Battle", icon: "mdi-sword-cross", to: "/battle" },
];

async function handleLogout() {
  authStore.logout();
  characterStore.clear();
  battleStore.clear();
  worldStore.clear();
  inventoryStore.clear();
  riftStore.clear();
  await navigateTo("/auth/login");
}
</script>
