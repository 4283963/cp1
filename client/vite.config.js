import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/forklift-ws': {
        target: 'ws://localhost:3000',
        ws: true,
        rewrite: (path) => path.replace(/^\/forklift-ws/, ''),
      },
    },
  },
});
