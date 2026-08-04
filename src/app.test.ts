import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.js';

const apps = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('GET /health', () => {
  it('returns the application health status', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
    });
  });

  it('remains healthy when the database readiness check would fail', async () => {
    const databaseReadinessCheck = vi.fn().mockRejectedValue(
      new Error('sensitive database failure'),
    );
    const app = buildApp({ logger: false, databaseReadinessCheck });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
    });
    expect(databaseReadinessCheck).not.toHaveBeenCalled();
  });
});

describe('GET /ready', () => {
  it('returns ready when the database responds', async () => {
    const databaseReadinessCheck = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ logger: false, databaseReadinessCheck });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
    });
    expect(databaseReadinessCheck).toHaveBeenCalledOnce();
  });

  it('returns a sanitized not-ready response when the database check fails', async () => {
    const sensitiveDetails =
      'Prisma connection failed for postgresql://user:password@database';
    const databaseReadinessCheck = vi
      .fn()
      .mockRejectedValue(new Error(sensitiveDetails));
    const app = buildApp({ logger: false, databaseReadinessCheck });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'not_ready',
    });
    expect(response.body).not.toContain(sensitiveDetails);
    expect(response.body).not.toContain('Prisma');
    expect(response.body).not.toContain('password');
  });
});
