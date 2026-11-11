import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:8080';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  // 开发代理目标:默认指向本地网关,可用 .env.<mode> 里的 VITE_API_PROXY_TARGET 覆盖。
  // 生产构建不经过此代理,部署时需由反向代理把 /api 转发到网关。
  const proxyTarget = env.VITE_API_PROXY_TARGET || DEFAULT_PROXY_TARGET;

  return {
    plugins: [vue()],
    server: {
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
