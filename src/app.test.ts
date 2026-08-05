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

  it.each([
    'http://localhost:5173',
    'http://localhost:5174',
    'https://amigo-do-lar-v2.vercel.app',
  ])('returns CORS headers for the allowed origin %s', async (origin) => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      origin,
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });

  it('handles requests without an Origin header', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not return an allow-origin header for a denied origin', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://invalid.example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
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

describe('CORS preflight', () => {
  it('handles PATCH preflight for an allowed origin and headers', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/customers',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type,authorization',
      },
    });

    expect([200, 204]).toContain(response.statusCode);
    expect(response.statusCode).not.toBe(404);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    const allowedMethods = response.headers['access-control-allow-methods'];
    const allowedHeaders = response.headers['access-control-allow-headers'];

    for (const method of [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ]) {
      expect(allowedMethods).toContain(method);
    }
    expect(allowedHeaders?.toLowerCase()).toContain('content-type');
    expect(allowedHeaders?.toLowerCase()).toContain('authorization');
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

describe('protected routes with CORS enabled', () => {
  it('keeps GET /customers protected without a token', async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: '/customers',
      headers: { origin: 'http://localhost:5173' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
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
