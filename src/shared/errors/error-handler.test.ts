import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildApp } from '../../app.js';
import type { ErrorDetail, ErrorResponse } from './error-response.js';
import { ConflictError } from './http-errors.js';

const apps = new Set<ReturnType<typeof buildApp>>();

function createApp() {
  const app = buildApp({ logger: false });
  apps.add(app);
  return app;
}

function expectStandardError(
  payload: ErrorResponse,
  expected: {
    code: string;
    message: string;
    statusCode: number;
    details?: ErrorDetail[];
  },
): void {
  expect(typeof payload.error.requestId).toBe('string');
  expect(payload).toMatchObject({
    error: {
      ...expected,
      details: expected.details ?? [],
      requestId: payload.error.requestId,
    },
  });
}

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('error handler', () => {
  it('returns a standard response for an unknown route', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/unknown',
    });

    expect(response.statusCode).toBe(404);
    expectStandardError(response.json<ErrorResponse>(), {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
    });
  });

  it('returns status 400 for Fastify validation errors', async () => {
    const app = createApp();
    app.post(
      '/validated',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      () => ({ status: 'ok' }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/validated',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expectStandardError(response.json<ErrorResponse>(), {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      details: [
        {
          code: 'required',
          field: 'name',
          message: "must have required property 'name'",
        },
      ],
    });
  });

  it('returns status 400 for Zod validation errors', async () => {
    const app = createApp();
    app.post('/zod-validated', (request) => {
      z.object({ email: z.email() }).parse(request.body);
      return { status: 'ok' };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/zod-validated',
      payload: { email: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
    expectStandardError(response.json<ErrorResponse>(), {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      details: [
        {
          code: 'invalid_format',
          field: 'email',
          message: 'Invalid email address',
        },
      ],
    });
  });

  it('returns the correct status for an operational error', async () => {
    const app = createApp();
    app.get('/conflict', () => {
      throw new ConflictError({
        code: 'SCHEDULE_CONFLICT',
        message: 'Schedule is unavailable',
      });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/conflict',
    });

    expect(response.statusCode).toBe(409);
    expectStandardError(response.json<ErrorResponse>(), {
      code: 'SCHEDULE_CONFLICT',
      message: 'Schedule is unavailable',
      statusCode: 409,
    });
  });

  it('returns a safe response for an unexpected error', async () => {
    const app = createApp();
    app.get('/unexpected', () => {
      throw new Error('database password: secret');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/unexpected',
    });
    const payload = response.json<ErrorResponse>();

    expect(response.statusCode).toBe(500);
    expectStandardError(payload, {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(JSON.stringify(payload)).not.toContain('stack');
  });

  it('maps Prisma P2002 to conflict without exposing database data', async () => {
    const app = createApp();
    app.get('/duplicate', () => {
      throw new Prisma.PrismaClientKnownRequestError('sensitive database data', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/duplicate',
    });
    const payload = response.json<ErrorResponse>();

    expect(response.statusCode).toBe(409);
    expectStandardError(payload, {
      code: 'RESOURCE_CONFLICT',
      message: 'A resource with the provided data already exists',
      statusCode: 409,
    });
    expect(JSON.stringify(payload)).not.toContain('sensitive');
    expect(JSON.stringify(payload)).not.toContain('email');
  });

  it('maps Prisma P2025 to not found', async () => {
    const app = createApp();
    app.get('/missing', () => {
      throw new Prisma.PrismaClientKnownRequestError('database record missing', {
        code: 'P2025',
        clientVersion: 'test',
      });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/missing',
    });

    expect(response.statusCode).toBe(404);
    expectStandardError(response.json<ErrorResponse>(), {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
    });
  });
});
