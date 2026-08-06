import { afterEach, describe, expect, it, vi } from 'vitest';

const s3StorageConstructor = vi.fn();

vi.mock(
  './modules/service-request-attachments/s3-attachment-storage.js',
  () => ({
    S3AttachmentStorage: class {
      constructor(...args: unknown[]) {
        s3StorageConstructor(...args);
      }
    },
  }),
);

import { buildApp } from './app.js';

const apps = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
  s3StorageConstructor.mockClear();
});

describe('disabled attachment storage', () => {
  it('does not instantiate S3 or register attachment routes while other routes work', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const attachmentResponse = await app.inject({
      method: 'GET',
      url: '/service-requests/11111111-1111-4111-8111-111111111111/attachments',
    });
    const healthResponse = await app.inject({ method: 'GET', url: '/health' });

    expect(s3StorageConstructor).not.toHaveBeenCalled();
    expect(attachmentResponse.statusCode).toBe(404);
    expect(attachmentResponse.json()).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ status: 'ok' });
  });
});
