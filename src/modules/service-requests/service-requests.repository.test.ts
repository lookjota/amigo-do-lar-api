import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(),
  txServiceFind: vi.fn(), txCustomerFind: vi.fn(), txCustomerCreate: vi.fn(),
  txDuplicateFind: vi.fn(), txRequestCreate: vi.fn(), txEventCreate: vi.fn(),
  txUserFind: vi.fn(), txNotificationCreate: vi.fn(),
}));

vi.mock('../../shared/database/index.js', () => ({
  database: {
    $transaction: mocks.transaction,
    serviceRequest: { findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique },
  },
}));

import { PrismaServiceRequestRepository } from './service-requests.repository.js';

const tx = {
  service: { findUnique: mocks.txServiceFind },
  customer: { findUnique: mocks.txCustomerFind, create: mocks.txCustomerCreate },
  serviceRequest: { findFirst: mocks.txDuplicateFind, create: mocks.txRequestCreate },
  serviceRequestEvent: { create: mocks.txEventCreate },
  user: { findMany: mocks.txUserFind },
  notification: { createMany: mocks.txNotificationCreate },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (argument: unknown) => {
    if (typeof argument === 'function') return (argument as (client: typeof tx) => unknown)(tx);
    return Promise.all(argument as Promise<unknown>[]);
  });
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.txEventCreate.mockResolvedValue({ id: 'event' });
  mocks.txUserFind.mockResolvedValue([]);
  mocks.txNotificationCreate.mockResolvedValue({ count: 0 });
});

describe('PrismaServiceRequestRepository', () => {
  it('maps filters, relationships, sorting and bounded pagination without N+1', async () => {
    await new PrismaServiceRequestRepository().list({
      page: 2, limit: 10, search: 'tomada', status: 'PENDING',
      customerId: '23ed23cf-22d0-414d-bbea-06b8b57b9703',
      serviceId: 'aa9a8c21-32fb-47ba-aef3-03ef668d727b',
      createdFrom: new Date('2026-08-01T00:00:00.000Z'),
      createdTo: new Date('2026-08-03T23:59:59.000Z'),
      preferredDateFrom: new Date('2026-08-10T00:00:00.000Z'),
      preferredDateTo: new Date('2026-08-20T00:00:00.000Z'),
      sortBy: 'createdAt', sortOrder: 'desc',
    });
    expect(mocks.findMany).toHaveBeenCalledOnce();
    const call = mocks.findMany.mock.calls[0]?.[0] as {
      include: Record<string, unknown>;
      orderBy: Record<string, string>;
      skip: number;
      take: number;
      where: { status: string; createdAt: { gte: Date; lte: Date } };
    };
    expect(Object.keys(call.include).sort()).toEqual(['customer', 'service']);
    expect(call.orderBy).toEqual({ createdAt: 'desc' });
    expect({ skip: call.skip, take: call.take }).toEqual({ skip: 10, take: 10 });
    expect(call.where.status).toBe('PENDING');
    expect(call.where.createdAt).toEqual({
      gte: new Date('2026-08-01T00:00:00.000Z'),
      lte: new Date('2026-08-03T23:59:59.000Z'),
    });
  });

  it('creates customer and request through the same interactive transaction', async () => {
    mocks.txServiceFind.mockResolvedValue({ id: 'service', isActive: true });
    mocks.txCustomerFind.mockResolvedValue(null);
    mocks.txCustomerCreate.mockResolvedValue({ id: 'customer' });
    mocks.txDuplicateFind.mockResolvedValue(null);
    mocks.txRequestCreate.mockResolvedValue({ id: 'request' });
    const result = await new PrismaServiceRequestRepository().createPublic({
      customer: { name: 'João', phone: '61999999999', email: null }, serviceId: 'service',
      description: 'Descrição válida', preferredDate: null, address: 'Endereço', city: 'Brasília',
      duplicateSince: new Date('2026-08-03T11:55:00.000Z'),
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(mocks.txCustomerCreate).toHaveBeenCalledBefore(mocks.txRequestCreate);
    expect(result).toEqual({ outcome: 'created', request: { id: 'request' } });
  });

  it('propagates request creation failure so Prisma rolls the transaction back', async () => {
    mocks.txServiceFind.mockResolvedValue({ id: 'service', isActive: true });
    mocks.txCustomerFind.mockResolvedValue(null);
    mocks.txCustomerCreate.mockResolvedValue({ id: 'customer' });
    mocks.txDuplicateFind.mockResolvedValue(null);
    mocks.txRequestCreate.mockRejectedValue(new Error('write failed'));
    await expect(new PrismaServiceRequestRepository().createPublic({
      customer: { name: 'João', phone: '61999999999', email: null }, serviceId: 'service',
      description: 'Descrição válida', preferredDate: null, address: 'Endereço', city: 'Brasília',
      duplicateSince: new Date(),
    })).rejects.toThrow('write failed');
  });

  it('propagates timeline failure so the request transaction is rolled back', async () => {
    mocks.txServiceFind.mockResolvedValue({ id: 'service', isActive: true });
    mocks.txCustomerFind.mockResolvedValue({ id: 'customer' });
    mocks.txDuplicateFind.mockResolvedValue(null);
    mocks.txRequestCreate.mockResolvedValue({ id: 'request' });
    mocks.txEventCreate.mockRejectedValue(new Error('timeline failed'));
    await expect(new PrismaServiceRequestRepository().createPublic({
      customer: { name: 'João', phone: '61999999999', email: null }, serviceId: 'service',
      description: 'Descrição válida', preferredDate: null, address: 'Endereço', city: 'Brasília',
      duplicateSince: new Date(),
    })).rejects.toThrow('timeline failed');
    expect(mocks.txRequestCreate).toHaveBeenCalledBefore(mocks.txEventCreate);
  });

  it('creates notifications atomically and propagates notification failure', async () => {
    mocks.txServiceFind.mockResolvedValue({ id: 'service', isActive: true });
    mocks.txCustomerFind.mockResolvedValue({ id: 'customer', name: 'João' });
    mocks.txDuplicateFind.mockResolvedValue(null);
    mocks.txRequestCreate.mockResolvedValue({ id: 'request' });
    mocks.txUserFind.mockResolvedValue([{ id: 'admin' }, { id: 'operator' }]);
    mocks.txNotificationCreate.mockRejectedValue(new Error('notification failed'));
    await expect(new PrismaServiceRequestRepository().createPublic({
      customer: { name: 'João', phone: '61999999999', email: null }, serviceId: 'service',
      description: 'Descrição válida', preferredDate: null, address: 'Endereço', city: 'Brasília',
      duplicateSince: new Date(),
    })).rejects.toThrow('notification failed');
    expect(mocks.txUserFind).toHaveBeenCalledWith({ where: { isActive: true, role: { in: ['ADMIN', 'OPERATOR'] } }, select: { id: true } });
    const notificationCall = mocks.txNotificationCreate.mock.calls[0]?.[0] as { data: Array<{ recipientUserId: string; actorUserId: string | null; type: string }> };
    expect(notificationCall.data).toEqual(expect.arrayContaining([
      { recipientUserId: 'admin', actorUserId: null, type: 'SERVICE_REQUEST_CREATED', title: 'Nova solicitação recebida', message: 'Uma nova solicitação foi criada por João.', resourceType: 'SERVICE_REQUEST', resourceId: 'request' },
      { recipientUserId: 'operator', actorUserId: null, type: 'SERVICE_REQUEST_CREATED', title: 'Nova solicitação recebida', message: 'Uma nova solicitação foi criada por João.', resourceType: 'SERVICE_REQUEST', resourceId: 'request' },
    ]));
  });
});
