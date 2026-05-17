import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify';

export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    vue: {
      template: { transformAssetUrls },
    },
    plugins: [vuetify({ autoImport: true })],
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3030',
    },
  },

  compatibilityDate: '2025-01-01',
});
