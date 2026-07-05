import { fileURLToPath } from 'node:url';
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify';

const tresWhitelist = ['TresCanvas', 'TresCanvasContext', 'TresLeches', 'TresScene'];
const modelsDir = fileURLToPath(new URL('../models', import.meta.url));

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

  // 3D model assets live in /models at the repo root (shared location, not
  // duplicated into frontend/public) -- served at /models/* directly from there.
  nitro: {
    publicAssets: [{ baseURL: '/models', dir: modelsDir }],
  },

  compatibilityDate: '2025-01-01',
});
