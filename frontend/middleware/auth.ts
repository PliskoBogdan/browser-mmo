export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined;
  await authStore.init(headers);

  if (!authStore.isAuthenticated && !to.path.startsWith('/auth')) {
    return navigateTo('/auth/login');
  }

  if (authStore.isAuthenticated && to.path.startsWith('/auth')) {
    return navigateTo('/world');
  }
});
