export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const initialized = ref(false);

  async function init(headers?: Record<string, string>) {
    if (initialized.value) return;
    const config = useRuntimeConfig();
    try {
      await $fetch(`${config.public.apiBase}/auth/me`, {
        credentials: 'include',
        headers: headers ?? {},
      });
      isAuthenticated.value = true;
    } catch {
      isAuthenticated.value = false;
    }
    initialized.value = true;
  }

  async function logout() {
    const config = useRuntimeConfig();
    await $fetch(`${config.public.apiBase}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    isAuthenticated.value = false;
    initialized.value = false;
  }

  return { isAuthenticated, initialized, init, logout };
});
