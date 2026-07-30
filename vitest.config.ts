import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      JWT_SECRET: 'test-only-jwt-secret-with-at-least-32-characters',
      JWT_EXPIRES_IN: '900',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'test-secure-password',
      ADMIN_NAME: 'Test Admin',
    },
    coverage: {
      provider: 'v8',
    },
    environment: 'node',
  },
});
