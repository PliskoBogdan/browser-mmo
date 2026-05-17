export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  authStore.init();

  if (!authStore.isAuthenticated && !to.path.startsWith('/auth')) {
    return navigateTo('/auth/login');
  }

  if (authStore.isAuthenticated && to.path.startsWith('/auth')) {
    return navigateTo('/world');
  }
});
