import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
  update: vi.fn(), updateMany: vi.fn(), transaction: vi.fn(),
}));
vi.mock('../../shared/database/index.js', () => ({ database: {
  user: { findMany: db.findMany, count: db.count, findUnique: db.findUnique, create: db.create, update: db.update, updateMany: db.updateMany },
  $transaction: db.transaction,
} }));

import { PrismaUserRepository } from './users.repository.js';

describe('PrismaUserRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.findMany.mockResolvedValue([]); db.count.mockResolvedValue(0);
    db.transaction.mockImplementation((value: unknown) => Array.isArray(value) ? Promise.all(value) : Promise.resolve((value as (client: unknown) => unknown)({ user: {
      findUnique: db.findUnique, count: db.count, update: db.update,
    } })));
  });

  it('maps pagination, search, role, active filter and ordering without selecting passwordHash', async () => {
    await new PrismaUserRepository().list({ page: 2, limit: 10, search: 'admin', role: 'ADMIN', isActive: true, orderBy: 'createdAt', sortOrder: 'desc' });
    const where = { role: 'ADMIN', isActive: true, OR: [
      { name: { contains: 'admin', mode: 'insensitive' } }, { email: { contains: 'admin', mode: 'insensitive' } },
    ] };
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, orderBy: { createdAt: 'desc' }, skip: 10, take: 10 }));
    expect(db.count).toHaveBeenCalledWith({ where });
    const listArgs = db.findMany.mock.calls[0]![0] as { select: Record<string, boolean> };
    expect(listArgs.select).not.toHaveProperty('passwordHash');
  });

  it('uses public projections for detail, email lookup and creation', async () => {
    db.findUnique.mockResolvedValue(null); db.create.mockResolvedValue({ id: 'id' });
    const repository = new PrismaUserRepository();
    await repository.findById('id'); await repository.findByEmail('test@example.com');
    await repository.create({ name: 'Test User', email: 'test@example.com', passwordHash: 'hash', role: 'OPERATOR', isActive: true });
    for (const call of db.findUnique.mock.calls) {
      expect((call[0] as { select: Record<string, boolean> }).select).not.toHaveProperty('passwordHash');
    }
    const createArgs = db.create.mock.calls[0]![0] as { select: Record<string, boolean>; data: { passwordHash: string } };
    expect(createArgs.select).not.toHaveProperty('passwordHash');
    expect(createArgs.data.passwordHash).toBe('hash');
  });

  it('maps a database email uniqueness violation to the user conflict', async () => {
    db.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002', clientVersion: 'test', meta: { target: ['email'] },
    }));
    await expect(new PrismaUserRepository().create({
      name: 'Test User', email: 'test@example.com', passwordHash: 'hash', role: 'OPERATOR', isActive: true,
    })).rejects.toMatchObject({ code: 'USER_EMAIL_ALREADY_EXISTS', statusCode: 409 });
  });

  it('updates profile and status transactionally and protects the last active admin', async () => {
    db.findUnique.mockResolvedValue({ id: 'id', role: 'ADMIN', isActive: true }); db.count.mockResolvedValue(1);
    const repository = new PrismaUserRepository();
    expect(await repository.update('id', { role: 'OPERATOR' })).toEqual({ outcome: 'last_active_admin' });
    expect(await repository.updateStatus('id', false)).toEqual({ outcome: 'last_active_admin' });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('updates password by id without returning the hash', async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const repository = new PrismaUserRepository();
    expect(await repository.updatePassword('id', 'test-hash')).toBe(true);
    expect(await repository.updatePassword('missing', 'test-hash')).toBe(false);
    expect(db.updateMany).toHaveBeenCalledWith({ where: { id: 'id' }, data: { passwordHash: 'test-hash' } });
  });
});
