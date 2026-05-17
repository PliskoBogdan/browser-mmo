<template>
  <v-card width="420" elevation="8">
    <v-card-title class="text-center pa-6">
      <v-icon size="48" color="primary" class="mb-2">mdi-skull-crossbones</v-icon>
      <div class="text-h5 font-weight-bold">MMO RPG</div>
      <div class="text-subtitle-2 text-medium-emphasis">Sign in to continue</div>
    </v-card-title>

    <v-card-text class="pa-6 pt-2">
      <v-form @submit.prevent="handleLogin">
        <v-text-field
          v-model="form.email"
          label="Email"
          type="email"
          prepend-inner-icon="mdi-email"
          variant="outlined"
          class="mb-3"
          :error-messages="errors.email"
          required
        />
        <v-text-field
          v-model="form.password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          prepend-inner-icon="mdi-lock"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          variant="outlined"
          class="mb-4"
          :error-messages="errors.password"
          required
          @click:append-inner="showPassword = !showPassword"
        />

        <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-4" density="compact">
          {{ errorMsg }}
        </v-alert>

        <v-btn type="submit" color="primary" block size="large" :loading="loading">
          Login
        </v-btn>
      </v-form>
    </v-card-text>

    <v-card-actions class="justify-center pb-4">
      <span class="text-medium-emphasis text-body-2">No account?</span>
      <v-btn variant="text" color="primary" size="small" to="/auth/register">Register</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'auth' });

const authStore = useAuthStore();
const config = useRuntimeConfig();

const form = reactive({ email: '', password: '' });
const errors = reactive({ email: '', password: '' });
const errorMsg = ref('');
const loading = ref(false);
const showPassword = ref(false);

async function handleLogin() {
  errorMsg.value = '';
  loading.value = true;
  try {
    await $fetch(`${config.public.apiBase}/auth/login`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    authStore.isAuthenticated = true;
    authStore.initialized = true;
    await navigateTo('/world');
  } catch (e: any) {
    errorMsg.value = e?.data?.message ?? 'Invalid credentials';
  } finally {
    loading.value = false;
  }
}
</script>
