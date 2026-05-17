export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const request = <T>(url: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> => {
    return $fetch<T>(`${config.public.apiBase}${url}`, {
      ...options,
      credentials: 'include',
      async onResponseError({ response }) {
        if (response.status === 401) {
          authStore.isAuthenticated = false;
          authStore.initialized = false;
          await navigateTo('/auth/login');
        }
      },
    });
  };

  return { request };
};
