import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('environment configuration', () => {
  it('uses the local server defaults when host and port are not defined', async () => {
    vi.stubEnv('HOST', undefined);
    vi.stubEnv('PORT', undefined);

    const { env } = await import('./env.js');

    expect(env.HOST).toBe('0.0.0.0');
    expect(env.PORT).toBe(3_000);
  });

  it('coerces the platform port to a number', async () => {
    vi.stubEnv('PORT', '4321');

    const { env } = await import('./env.js');

    expect(env.PORT).toBe(4_321);
  });

  it('normalizes a comma-separated CORS origin allowlist', async () => {
    vi.stubEnv(
      'CORS_ORIGINS',
      ' http://localhost:5173, ,https://frontend.example.com ',
    );

    const { env } = await import('./env.js');

    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://frontend.example.com',
    ]);
  });

  it.each(['', ' , ', '*', 'https://frontend.example.com/path'])(
    'rejects an invalid CORS origin allowlist: %j',
    async (corsOrigins) => {
      vi.stubEnv('CORS_ORIGINS', corsOrigins);

      await expect(import('./env.js')).rejects.toThrow(
        'Invalid environment variables',
      );
    },
  );
});
