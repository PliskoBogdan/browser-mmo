export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const request = <T>(url: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> => {
    return $fetch<T>(`${config.public.apiBase}${url}`, {
      ...options,
      headers: {
        ...((options as any).headers ?? {}),
        ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
      },
      onResponseError({ response }) {
        if (response.status === 401) {
          authStore.logout();
          navigateTo('/auth/login');
        }
      },
    });
  };

  return { request };
};
