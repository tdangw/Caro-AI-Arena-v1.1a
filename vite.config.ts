import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const REPO_NAME = 'Caro-AI-Arena-v1.1a';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    base: `/${REPO_NAME}/`,

    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
  };
});
