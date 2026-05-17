<template>
  <v-card width="420" elevation="8">
    <v-card-title class="text-center pa-6">
      <v-icon size="48" color="primary" class="mb-2">mdi-skull-crossbones</v-icon>
      <div class="text-h5 font-weight-bold">Create Account</div>
      <div class="text-subtitle-2 text-medium-emphasis">Join the wasteland</div>
    </v-card-title>

    <v-card-text class="pa-6 pt-2">
      <v-form @submit.prevent="handleRegister">
        <v-text-field
          v-model="form.username"
          label="Username"
          prepend-inner-icon="mdi-account"
          variant="outlined"
          class="mb-3"
          required
        />
        <v-text-field
          v-model="form.email"
          label="Email"
          type="email"
          prepend-inner-icon="mdi-email"
          variant="outlined"
          class="mb-3"
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
          required
          @click:append-inner="showPassword = !showPassword"
        />

        <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-4" density="compact">
          {{ errorMsg }}
        </v-alert>

        <v-btn type="submit" color="primary" block size="large" :loading="loading">
          Register
        </v-btn>
      </v-form>
    </v-card-text>

    <v-card-actions class="justify-center pb-4">
      <span class="text-medium-emphasis text-body-2">Already have an account?</span>
      <v-btn variant="text" color="primary" size="small" to="/auth/login">Login</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'auth' });

const authStore = useAuthStore();
const config = useRuntimeConfig();

const form = reactive({ username: '', email: '', password: '' });
const errorMsg = ref('');
const loading = ref(false);
const showPassword = ref(false);

async function handleRegister() {
  errorMsg.value = '';
  loading.value = true;
  try {
    const data = await $fetch<{ access_token: string }>(`${config.public.apiBase}/auth/register`, {
      method: 'POST',
      body: form,
    });
    authStore.setToken(data.access_token);
    await navigateTo('/world');
  } catch (e: any) {
    errorMsg.value = e?.data?.message ?? 'Registration failed';
  } finally {
    loading.value = false;
  }
}
</script>
