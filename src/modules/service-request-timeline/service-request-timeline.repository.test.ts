import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), requestFind: vi.fn(), eventFindMany: vi.fn(), eventCount: vi.fn(), eventCreate: vi.fn(),
}));
vi.mock('../../shared/database/index.js', () => ({ database: {
  $transaction: mocks.transaction,
  serviceRequest: { findUnique: mocks.requestFind },
  serviceRequestEvent: { findMany: mocks.eventFindMany, count: mocks.eventCount },
} }));
import { PrismaServiceRequestTimelineRepository, appendTimelineEvent } from './service-request-timeline.repository.js';

const tx = { serviceRequest: { findUnique: mocks.requestFind }, serviceRequestEvent: { create: mocks.eventCreate } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((argument: unknown) => Promise.resolve(typeof argument === 'function'
    ? (argument as (client: typeof tx) => unknown)(tx)
    : Promise.all(argument as Promise<unknown>[])));
  mocks.eventFindMany.mockResolvedValue([]); mocks.eventCount.mockResolvedValue(0);
});

describe('PrismaServiceRequestTimelineRepository', () => {
  it('paginates, orders deterministically, filters by type and selects only the sanitized actor', async () => {
    await new PrismaServiceRequestTimelineRepository().list('request', { page: 2, limit: 10, type: 'COMMENT_ADDED', sortOrder: 'asc' });
    const call = mocks.eventFindMany.mock.calls[0]?.[0] as { where: object; orderBy: object[]; skip: number; take: number; select: { actor: { select: object } } };
    expect(call.where).toEqual({ serviceRequestId: 'request', visibility: 'INTERNAL', type: 'COMMENT_ADDED' });
    expect(call.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect({ skip: call.skip, take: call.take }).toEqual({ skip: 10, take: 10 });
    expect(call.select.actor.select).toEqual({ id: true, name: true, email: true, role: true });
    expect(call.select.actor.select).not.toHaveProperty('passwordHash');
  });

  it('creates optional-actor events through the supplied transaction client', async () => {
    mocks.eventCreate.mockResolvedValue({ id: 'event', actor: null });
    await expect(appendTimelineEvent(tx as never, { serviceRequestId: 'request', type: 'REQUEST_CREATED', title: 'Solicitação criada' })).resolves.toEqual({ id: 'event', actor: null });
    const call = mocks.eventCreate.mock.calls[0]?.[0] as unknown as { data: { actorUserId: string | null; visibility: string } };
    expect(call.data).toMatchObject({ actorUserId: null, visibility: 'INTERNAL' });
  });

  it('checks existence and creates a comment atomically', async () => {
    mocks.requestFind.mockResolvedValue({ id: 'request' }); mocks.eventCreate.mockResolvedValue({ id: 'event' });
    await expect(new PrismaServiceRequestTimelineRepository().createComment('request', 'actor', 'texto')).resolves.toEqual({ id: 'event' });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function));
    const call = mocks.eventCreate.mock.calls[0]?.[0] as unknown as { data: { actorUserId: string | null; description: string; type: string } };
    expect(call.data).toMatchObject({ actorUserId: 'actor', description: 'texto', type: 'COMMENT_ADDED' });
  });
});
