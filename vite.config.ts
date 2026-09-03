import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const proxyTargets: Record<string, string> = {
  dev: 'http://127.0.0.1:8080',
  stage: 'http://127.0.0.1:8080',
  prod: 'http://127.0.0.1:8080'
};

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: proxyTargets[mode] || proxyTargets.dev,
        changeOrigin: true
      }
    }
  }
}));
