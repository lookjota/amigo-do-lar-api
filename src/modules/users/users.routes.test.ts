import type { UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { verifyPassword } from '../../shared/auth/password.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';
import type { UserRepository } from './users.repository.js';
import type { CreateUserData, ListUsersInput, PublicUserEntity, UpdateUserData, UserMutationResult } from './users.types.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const OPERATOR_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-08-05T12:00:00.000Z');
interface StoredUser extends PublicUserEntity { passwordHash: string }

class InMemoryUserRepository implements UserRepository {
  users: StoredUser[] = [
    { id: ADMIN_ID, name: 'Admin One', email: 'admin@example.com', role: 'ADMIN', isActive: true, passwordHash: 'hash', createdAt: now, updatedAt: now },
    { id: SECOND_ADMIN_ID, name: 'Admin Two', email: 'second@example.com', role: 'ADMIN', isActive: true, passwordHash: 'hash', createdAt: now, updatedAt: now },
    { id: OPERATOR_ID, name: 'Operator', email: 'operator@example.com', role: 'OPERATOR', isActive: true, passwordHash: 'hash', createdAt: now, updatedAt: now },
  ];
  private public(user: StoredUser): PublicUserEntity {
    return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
  list(input: ListUsersInput) {
    const search = input.search?.toLowerCase();
    const filtered = this.users.filter((user) => (!input.role || user.role === input.role) &&
      (input.isActive === undefined || user.isActive === input.isActive) &&
      (!search || user.name.toLowerCase().includes(search) || user.email.includes(search)));
    const ordered = [...filtered].sort((a, b) => String(a[input.orderBy]).localeCompare(String(b[input.orderBy])) * (input.sortOrder === 'asc' ? 1 : -1));
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({ data: ordered.slice(start, start + input.limit).map((user) => this.public(user)), total: filtered.length });
  }
  findById(id: string) { const user = this.users.find((item) => item.id === id); return Promise.resolve(user ? this.public(user) : null); }
  findByEmail(email: string) { const user = this.users.find((item) => item.email === email); return Promise.resolve(user ? this.public(user) : null); }
  create(input: CreateUserData) {
    const user: StoredUser = { ...input, id: '55555555-5555-4555-8555-555555555555', createdAt: now, updatedAt: now };
    this.users.push(user); return Promise.resolve(this.public(user));
  }
  update(id: string, input: UpdateUserData): Promise<UserMutationResult> { return this.mutate(id, input); }
  updateStatus(id: string, isActive: boolean): Promise<UserMutationResult> { return this.mutate(id, { isActive }); }
  updatePassword(id: string, passwordHash: string) { const user = this.users.find((item) => item.id === id); if (!user) return Promise.resolve(false); user.passwordHash = passwordHash; return Promise.resolve(true); }
  private mutate(id: string, input: UpdateUserData & { isActive?: boolean }): Promise<UserMutationResult> {
    const user = this.users.find((item) => item.id === id); if (!user) return Promise.resolve({ outcome: 'not_found' });
    const removesAdmin = user.role === 'ADMIN' && user.isActive && (input.role === 'OPERATOR' || input.isActive === false);
    if (removesAdmin && this.users.filter((item) => item.role === 'ADMIN' && item.isActive).length === 1) return Promise.resolve({ outcome: 'last_active_admin' });
    Object.assign(user, input); return Promise.resolve({ outcome: 'updated', user: this.public(user) });
  }
}

const apps = new Set<FastifyInstance>(); let repository: InMemoryUserRepository;
function app(): FastifyInstance { const instance = buildApp({ logger: false, userRepository: repository }); apps.add(instance); return instance; }
async function auth(role: UserRole, sub = ADMIN_ID): Promise<string> { const instance = app(); await instance.ready(); return `Bearer ${instance.jwt.sign({ sub, role })}`; }
beforeEach(() => { repository = new InMemoryUserRepository(); });
afterEach(async () => { await Promise.all([...apps].map((instance) => instance.close())); apps.clear(); });

describe('administrative user routes', () => {
  it('requires authentication and rejects OPERATOR on every endpoint', async () => {
    expect((await app().inject('/users')).statusCode).toBe(401);
    const authorization = await auth('OPERATOR', OPERATOR_ID);
    const requests = [
      { method: 'GET', url: '/users' }, { method: 'GET', url: `/users/${ADMIN_ID}` },
      { method: 'POST', url: '/users', payload: { name: 'New User', email: 'new@example.com', password: 'test-password-123', role: 'OPERATOR' } },
      { method: 'PATCH', url: `/users/${ADMIN_ID}`, payload: { name: 'Changed Name' } },
      { method: 'PATCH', url: `/users/${ADMIN_ID}/status`, payload: { isActive: false } },
      { method: 'PATCH', url: `/users/${ADMIN_ID}/password`, payload: { password: 'test-password-456' } },
    ] as const;
    for (const request of requests) expect((await app().inject({ ...request, headers: { authorization } })).statusCode).toBe(403);
  });

  it('lists with pagination, search, role and active filters without hashes', async () => {
    const response = await app().inject({ url: '/users?search=operator&role=OPERATOR&isActive=true&page=1&limit=1&orderBy=email&sortOrder=asc', headers: { authorization: await auth('ADMIN') } });
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ data: [{ id: OPERATOR_ID }], pagination: { total: 1, totalPages: 1 } });
    expect(response.body).not.toContain('passwordHash');
  });

  it('gets details and returns 404 for an unknown user', async () => {
    const headers = { authorization: await auth('ADMIN') };
    expect((await app().inject({ url: `/users/${OPERATOR_ID}`, headers })).json()).toMatchObject({ id: OPERATOR_ID, role: 'OPERATOR' });
    const missing = await app().inject({ url: `/users/${MISSING_ID}`, headers });
    expect(missing.statusCode).toBe(404); expect(missing.json<ErrorResponse>().error.code).toBe('USER_NOT_FOUND');
  });

  it('creates normalized users, hashes passwords and rejects duplicate email', async () => {
    const headers = { authorization: await auth('ADMIN') };
    const created = await app().inject({ method: 'POST', url: '/users', headers, payload: { name: '  New   Operator ', email: ' NEW@Example.COM ', password: 'test-password-123', role: 'OPERATOR', isActive: false } });
    expect(created.statusCode).toBe(201); expect(created.json()).toMatchObject({ name: 'New Operator', email: 'new@example.com', isActive: false });
    expect(created.body).not.toContain('password');
    expect(await verifyPassword(repository.users.at(-1)!.passwordHash, 'test-password-123')).toBe(true);
    const duplicate = await app().inject({ method: 'POST', url: '/users', headers, payload: { name: 'Duplicate', email: ' ADMIN@example.com ', password: 'test-password-123', role: 'ADMIN' } });
    expect(duplicate.statusCode).toBe(409); expect(duplicate.json<ErrorResponse>().error.code).toBe('USER_EMAIL_ALREADY_EXISTS');
  });

  it('updates allowed fields and rejects empty or passwordHash payloads', async () => {
    const headers = { authorization: await auth('ADMIN') };
    const updated = await app().inject({ method: 'PATCH', url: `/users/${OPERATOR_ID}`, headers, payload: { name: '  Updated   Operator ', email: 'UPDATED@EXAMPLE.COM', role: 'ADMIN' } });
    expect(updated.json()).toMatchObject({ name: 'Updated Operator', email: 'updated@example.com', role: 'ADMIN' });
    expect((await app().inject({ method: 'PATCH', url: `/users/${OPERATOR_ID}`, headers, payload: {} })).statusCode).toBe(400);
    expect((await app().inject({ method: 'PATCH', url: `/users/${OPERATOR_ID}`, headers, payload: { passwordHash: 'forbidden' } })).statusCode).toBe(400);
  });

  it('prevents self-deactivation and protects the last active ADMIN', async () => {
    const headers = { authorization: await auth('ADMIN') };
    const self = await app().inject({ method: 'PATCH', url: `/users/${ADMIN_ID}/status`, headers, payload: { isActive: false } });
    expect(self.statusCode).toBe(409); expect(self.json<ErrorResponse>().error.code).toBe('SELF_DEACTIVATION_FORBIDDEN');
    await app().inject({ method: 'PATCH', url: `/users/${SECOND_ADMIN_ID}/status`, headers, payload: { isActive: false } });
    const last = await app().inject({ method: 'PATCH', url: `/users/${ADMIN_ID}`, headers, payload: { role: 'OPERATOR' } });
    expect(last.statusCode).toBe(409); expect(last.json<ErrorResponse>().error.code).toBe('LAST_ACTIVE_ADMIN');
  });

  it('changes status and resets password with 204', async () => {
    const headers = { authorization: await auth('ADMIN') };
    const status = await app().inject({ method: 'PATCH', url: `/users/${OPERATOR_ID}/status`, headers, payload: { isActive: false } });
    expect(status.json()).toMatchObject({ isActive: false });
    const password = await app().inject({ method: 'PATCH', url: `/users/${OPERATOR_ID}/password`, headers, payload: { password: 'changed-test-123' } });
    expect(password.statusCode).toBe(204); expect(password.body).toBe('');
    expect(await verifyPassword(repository.users.find((user) => user.id === OPERATOR_ID)!.passwordHash, 'changed-test-123')).toBe(true);
    expect((await app().inject({ method: 'PATCH', url: `/users/${MISSING_ID}/password`, headers, payload: { password: 'changed-test-123' } })).statusCode).toBe(404);
  });

  it('rejects invalid payloads and stale ADMIN claims', async () => {
    const adminToken = await auth('ADMIN');
    expect((await app().inject({ method: 'POST', url: '/users', headers: { authorization: adminToken }, payload: { name: 'A', email: 'bad', password: 'short', role: 'INVALID' } })).statusCode).toBe(400);
    repository.users.find((user) => user.id === ADMIN_ID)!.role = 'OPERATOR';
    expect((await app().inject({ url: '/users', headers: { authorization: adminToken } })).statusCode).toBe(403);
  });
});
