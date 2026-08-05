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

describe('CORS', () => {
  it.each([
    'http://localhost:5173',
    'http://localhost:5174',
    'https://amigo-do-lar-v2.vercel.app',
  ])('allows the configured origin %s', async (origin) => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('does not allow an origin that is not configured', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://untrusted.example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps requests without an Origin header working', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('handles login preflight with the configured headers and methods', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, authorization',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toBe(
      'Content-Type, Authorization',
    );
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
