import { describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../../shared/auth/password.js';
import type { UserRepository } from './users.repository.js';
import { UsersService } from './users.service.js';
import type { PublicUserEntity } from './users.types.js';

const actor: PublicUserEntity = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Admin', email: 'admin@example.com',
  role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date(),
};

function repository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findById: vi.fn().mockImplementation((id: string) => Promise.resolve(id === actor.id ? actor : null)),
    findByEmail: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn(),
    updateStatus: vi.fn(), updatePassword: vi.fn(), ...overrides,
  };
}

describe('UsersService', () => {
  it('normalizes creation data, hashes the password and never returns the hash', async () => {
    const create = vi.fn().mockImplementation((input: { name: string; email: string; passwordHash: string }) => Promise.resolve({
      ...actor, id: '22222222-2222-4222-8222-222222222222', name: input.name, email: input.email, role: 'OPERATOR',
    }));
    const service = new UsersService(repository({ create }));
    const result = await service.create({ name: '  Test   User ', email: ' TEST@EXAMPLE.COM ', password: 'test-password-123', role: 'OPERATOR' }, actor.id);
    const input = create.mock.calls[0]![0] as { passwordHash: string };
    expect(result).toMatchObject({ name: 'Test User', email: 'test@example.com' });
    expect(result).not.toHaveProperty('passwordHash');
    expect(await verifyPassword(input.passwordHash, 'test-password-123')).toBe(true);
  });

  it('maps missing users, duplicate emails and last-admin outcomes', async () => {
    const duplicateRepository = repository({ findByEmail: vi.fn().mockResolvedValue(actor) });
    await expect(new UsersService(duplicateRepository).create({ name: 'Test User', email: actor.email, password: 'test-password-123', role: 'OPERATOR' }, actor.id))
      .rejects.toMatchObject({ code: 'USER_EMAIL_ALREADY_EXISTS', statusCode: 409 });

    await expect(new UsersService(repository()).getById('missing', actor.id))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });

    const lastAdminRepository = repository({ update: vi.fn().mockResolvedValue({ outcome: 'last_active_admin' }) });
    await expect(new UsersService(lastAdminRepository).update(actor.id, { role: 'OPERATOR' }, actor.id))
      .rejects.toMatchObject({ code: 'LAST_ACTIVE_ADMIN', statusCode: 409 });
  });

  it('prevents self-deactivation and denies stale or inactive admin identities', async () => {
    await expect(new UsersService(repository()).updateStatus(actor.id, { isActive: false }, actor.id))
      .rejects.toMatchObject({ code: 'SELF_DEACTIVATION_FORBIDDEN', statusCode: 409 });
    const inactive = { ...actor, isActive: false };
    await expect(new UsersService(repository({ findById: vi.fn().mockResolvedValue(inactive) })).list({ page: 1, limit: 20, orderBy: 'name', sortOrder: 'asc' }, actor.id))
      .rejects.toMatchObject({ code: 'ADMIN_ACCESS_REQUIRED', statusCode: 403 });
  });

  it('hashes password resets and maps an unknown target to 404', async () => {
    const updatePassword = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = new UsersService(repository({ updatePassword }));
    await service.resetPassword('target', { password: 'changed-test-123' }, actor.id);
    expect(await verifyPassword(updatePassword.mock.calls[0]![1] as string, 'changed-test-123')).toBe(true);
    await expect(service.resetPassword('missing', { password: 'changed-test-123' }, actor.id))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });
});
