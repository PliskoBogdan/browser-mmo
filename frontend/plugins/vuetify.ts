import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    theme: {
      defaultTheme: 'dark',
      themes: {
        dark: {
          dark: true,
          colors: {
            primary: '#b71c1c',
            secondary: '#37474f',
            accent: '#ff6f00',
            background: '#0d0d0d',
            surface: '#1a1a1a',
            error: '#cf6679',
            success: '#4caf50',
            warning: '#ff9800',
            info: '#29b6f6',
          },
        },
      },
    },
  });

  app.vueApp.use(vuetify);
});
