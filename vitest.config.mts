import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'mock-api-key-for-tests',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'bank-of-school-test',
      NEXT_PUBLIC_APP_ID: 'test-school-app',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
