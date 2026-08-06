import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('environment configuration', () => {
  function configureAttachmentEnvironment(
    nodeEnv: 'test' | 'production',
    driver: 's3' | 'fake' | 'disabled' | undefined,
  ): void {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost:5432/app');
    vi.stubEnv('ATTACHMENT_STORAGE_DRIVER', driver);
    vi.stubEnv('S3_ENDPOINT', undefined);
    vi.stubEnv('S3_REGION', undefined);
    vi.stubEnv('S3_BUCKET', undefined);
    vi.stubEnv('S3_ACCESS_KEY_ID', undefined);
    vi.stubEnv('S3_SECRET_ACCESS_KEY', undefined);
  }

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

  it('parses, trims, and removes empty CORS origins', async () => {
    vi.stubEnv(
      'CORS_ORIGINS',
      ' http://localhost:5173, ,https://amigo-do-lar-v2.vercel.app,',
    );

    const { env } = await import('./env.js');

    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://amigo-do-lar-v2.vercel.app',
    ]);
  });

  it.each([
    '',
    ' , ',
    '*',
    'https://frontend.example.com/path',
    'http://localhost:5173,not-a-url',
  ])(
    'rejects an invalid CORS origin allowlist: %j',
    async (corsOrigins) => {
      vi.stubEnv('CORS_ORIGINS', corsOrigins);

      await expect(import('./env.js')).rejects.toThrow(
        'Invalid environment variables',
      );
    },
  );

  it('defaults to disabled and starts in production without S3 configuration', async () => {
    configureAttachmentEnvironment('production', undefined);

    const { env } = await import('./env.js');

    expect(env.ATTACHMENT_STORAGE_DRIVER).toBe('disabled');
  });

  it('allows an explicitly disabled driver in production without S3 configuration', async () => {
    configureAttachmentEnvironment('production', 'disabled');

    const { env } = await import('./env.js');

    expect(env.ATTACHMENT_STORAGE_DRIVER).toBe('disabled');
  });

  it('rejects S3 in production when its configuration is incomplete', async () => {
    configureAttachmentEnvironment('production', 's3');

    await expect(import('./env.js')).rejects.toThrow(
      'S3_ENDPOINT is required for S3 attachment storage',
    );
  });

  it('allows fake attachment storage in tests', async () => {
    configureAttachmentEnvironment('test', 'fake');

    const { env } = await import('./env.js');

    expect(env.ATTACHMENT_STORAGE_DRIVER).toBe('fake');
  });

  it('rejects fake attachment storage in production', async () => {
    configureAttachmentEnvironment('production', 'fake');

    await expect(import('./env.js')).rejects.toThrow(
      'Fake attachment storage is allowed only in tests',
    );
  });

  it('allows S3 when its complete configuration is provided', async () => {
    configureAttachmentEnvironment('production', 's3');
    vi.stubEnv('S3_ENDPOINT', 'https://storage.example.com');
    vi.stubEnv('S3_REGION', 'us-east-1');
    vi.stubEnv('S3_BUCKET', 'attachments');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'access-key');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret-key');

    const { env } = await import('./env.js');

    expect(env).toMatchObject({
      ATTACHMENT_STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'https://storage.example.com',
      S3_BUCKET: 'attachments',
    });
  });
});
