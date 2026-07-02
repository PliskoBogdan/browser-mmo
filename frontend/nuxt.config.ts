import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify';

const tresWhitelist = ['TresCanvas', 'TresCanvasContext', 'TresLeches', 'TresScene'];

export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    vue: {
      template: {
        transformAssetUrls,
        compilerOptions: {
          isCustomElement: (tag: string) => ((/^Tres[A-Z]/.test(tag) || tag.startsWith('tres-')) && !tresWhitelist.includes(tag)) || tag === 'primitive',
        },
      },
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
