import { UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { hashPassword } from '../../shared/auth/password.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';
import type { AuthRepository } from './auth.repository.js';
import type { AuthUser } from './auth.types.js';

const activeUser: AuthUser = {
  id: 'b32efc7d-bb72-4d0b-a64b-b34f4fc83bad',
  name: 'Admin',
  email: 'admin@example.com',
  passwordHash: '',
  role: UserRole.ADMIN,
  isActive: true,
};

const inactiveUser: AuthUser = {
  ...activeUser,
  id: 'e95dd11c-e274-4b7a-b92f-081e5ca84926',
  email: 'inactive@example.com',
  isActive: false,
};

class InMemoryAuthRepository implements AuthRepository {
  constructor(private readonly users: AuthUser[]) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(
      this.users.find((user) => user.email === email) ?? null,
    );
  }

  findById(id: string): Promise<AuthUser | null> {
    return Promise.resolve(
      this.users.find((user) => user.id === id) ?? null,
    );
  }
}

const apps = new Set<FastifyInstance>();
let repository: AuthRepository;

function createApp(): FastifyInstance {
  const app = buildApp({ logger: false, authRepository: repository });
  apps.add(app);
  return app;
}

function credentials(email: string, password: string) {
  return { email, password };
}

function errorShape(response: ErrorResponse) {
  return {
    code: response.error.code,
    message: response.error.message,
    statusCode: response.error.statusCode,
    details: response.error.details,
  };
}

beforeAll(async () => {
  const passwordHash = await hashPassword('secure-password');
  repository = new InMemoryAuthRepository([
    { ...activeUser, passwordHash },
    { ...inactiveUser, passwordHash },
  ]);
});

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('authentication routes', () => {
  it('returns an access token for valid credentials', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: credentials('admin@example.com', 'secure-password'),
    });
    const payload = response.json<Record<string, unknown>>();

    expect(response.statusCode).toBe(200);
    expect(typeof payload.accessToken).toBe('string');
    expect(payload).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        role: UserRole.ADMIN,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('passwordHash');
  });

  it('returns the same generic error for an unknown email and wrong password', async () => {
    const app = createApp();
    const [unknownEmail, wrongPassword] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: credentials('missing@example.com', 'secure-password'),
      }),
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: credentials('admin@example.com', 'wrong-password'),
      }),
    ]);

    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(errorShape(unknownEmail.json<ErrorResponse>())).toEqual(
      errorShape(wrongPassword.json<ErrorResponse>()),
    );
    expect(errorShape(unknownEmail.json<ErrorResponse>())).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      statusCode: 401,
      details: [],
    });
  });

  it('does not authenticate an inactive user', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: credentials('inactive@example.com', 'secure-password'),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<ErrorResponse>().error.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('rejects /auth/me without a token', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<ErrorResponse>().error.code).toBe('UNAUTHORIZED');
  });

  it('returns the public authenticated user with a valid token', async () => {
    const app = createApp();
    await app.ready();
    const token = app.jwt.sign({
      sub: activeUser.id,
      role: activeUser.role,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    const payload = response.json<Record<string, unknown>>();

    expect(response.statusCode).toBe(200);
    expect(payload).toEqual({
      id: activeUser.id,
      name: activeUser.name,
      email: activeUser.email,
      role: activeUser.role,
    });
    expect(JSON.stringify(payload)).not.toContain('passwordHash');
  });

  it('rejects an expired access token', async () => {
    const app = createApp();
    await app.ready();
    const token = app.jwt.sign(
      { sub: activeUser.id, role: activeUser.role },
      { expiresIn: -1 },
    );
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<ErrorResponse>().error.code).toBe('UNAUTHORIZED');
  });
});

describe('role authorization', () => {
  function createAuthorizedApp(): FastifyInstance {
    const app = createApp();
    app.get(
      '/admin-only',
      { onRequest: [authenticate, authorize([UserRole.ADMIN])] },
      () => ({ allowed: true }),
    );
    return app;
  }

  it('allows the required role', async () => {
    const app = createAuthorizedApp();
    await app.ready();
    const token = app.jwt.sign({
      sub: activeUser.id,
      role: UserRole.ADMIN,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects a different role with status 403', async () => {
    const app = createAuthorizedApp();
    await app.ready();
    const token = app.jwt.sign({
      sub: activeUser.id,
      role: UserRole.OPERATOR,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<ErrorResponse>().error.code).toBe('FORBIDDEN');
  });
});
