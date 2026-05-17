export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  function init() {
    if (import.meta.client) {
      token.value = localStorage.getItem('auth_token');
    }
  }

  function setToken(t: string) {
    token.value = t;
    if (import.meta.client) localStorage.setItem('auth_token', t);
  }

  function logout() {
    token.value = null;
    if (import.meta.client) localStorage.removeItem('auth_token');
  }

  return { token, isAuthenticated, init, setToken, logout };
});
