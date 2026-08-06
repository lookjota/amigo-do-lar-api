import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestFind: vi.fn(), eventFindMany: vi.fn() }));
vi.mock('../../shared/database/index.js', () => ({ database: {
  serviceRequest: { findUnique: mocks.requestFind }, serviceRequestEvent: { findMany: mocks.eventFindMany },
} }));
import { PrismaServiceRequestActivityRepository } from './service-request-activity.repository.js';

beforeEach(() => { vi.clearAllMocks(); mocks.eventFindMany.mockResolvedValue([]); });

describe('PrismaServiceRequestActivityRepository', () => {
  it('isolates the request, filters in SQL, orders stably and fetches one look-ahead row', async () => {
    await new PrismaServiceRequestActivityRepository().list('request', {
      limit: 10, type: 'COMMENT_ADDED', category: 'COMMENT', sortOrder: 'asc',
      cursor: { createdAt: new Date('2026-08-05T12:00:00.000Z'), id: '22222222-2222-4222-8222-222222222222' },
    });
    const call = mocks.eventFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; orderBy: object[]; take: number; select: { actor: { select: object } } };
    expect(call.where).toMatchObject({ serviceRequestId: 'request', visibility: 'INTERNAL' });
    expect(call.where.AND).toEqual([{ type: 'COMMENT_ADDED' }, { type: { in: ['COMMENT_ADDED'] } }, { OR: [{ createdAt: { gt: new Date('2026-08-05T12:00:00.000Z') } }, { createdAt: new Date('2026-08-05T12:00:00.000Z'), id: { gt: '22222222-2222-4222-8222-222222222222' } }] }]);
    expect(call.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(call.take).toBe(11);
    expect(call.select.actor.select).toEqual({ id: true, name: true, email: true, role: true });
    expect(call.select.actor.select).not.toHaveProperty('passwordHash');
    expect(mocks.eventFindMany).toHaveBeenCalledOnce();
  });

  it('uses both timestamp and id for descending cursors', async () => {
    const cursor = { createdAt: new Date('2026-08-05T12:00:00.000Z'), id: 'id' };
    await new PrismaServiceRequestActivityRepository().list('request', { limit: 20, sortOrder: 'desc', cursor });
    const call = mocks.eventFindMany.mock.calls[0]?.[0] as { where: { AND: object[] } };
    expect(call.where.AND).toEqual([{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: 'id' } }] }]);
  });
});
