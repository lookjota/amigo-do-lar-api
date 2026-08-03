import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(),
  txRequestFind: vi.fn(), txRequestUpdate: vi.fn(),
  txAppointmentFindFirst: vi.fn(), txAppointmentFindMany: vi.fn(),
  txAppointmentCreate: vi.fn(), txAppointmentFindUnique: vi.fn(),
  txAppointmentFindUniqueOrThrow: vi.fn(), txAppointmentUpdate: vi.fn(),
  txAppointmentUpdateMany: vi.fn(),
}));

vi.mock('../../shared/database/index.js', () => ({
  database: {
    $transaction: mocks.transaction,
    appointment: {
      findMany: mocks.findMany,
      count: mocks.count,
      findUnique: mocks.findUnique,
    },
  },
}));

import { PrismaAppointmentRepository } from './appointments.repository.js';

const tx = {
  serviceRequest: { findUnique: mocks.txRequestFind, update: mocks.txRequestUpdate },
  appointment: {
    findFirst: mocks.txAppointmentFindFirst,
    findMany: mocks.txAppointmentFindMany,
    create: mocks.txAppointmentCreate,
    findUnique: mocks.txAppointmentFindUnique,
    findUniqueOrThrow: mocks.txAppointmentFindUniqueOrThrow,
    update: mocks.txAppointmentUpdate,
    updateMany: mocks.txAppointmentUpdateMany,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (argument: unknown) => {
    if (typeof argument === 'function') return (argument as (client: typeof tx) => unknown)(tx);
    return Promise.all(argument as Promise<unknown>[]);
  });
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.txRequestFind.mockResolvedValue({ status: 'APPROVED' });
  mocks.txAppointmentFindFirst.mockResolvedValue(null);
  mocks.txAppointmentFindMany.mockResolvedValue([]);
  mocks.txAppointmentCreate.mockResolvedValue({ id: 'appointment', serviceRequest: { status: 'APPROVED' } });
  mocks.txRequestUpdate.mockResolvedValue({});
});

describe('PrismaAppointmentRepository', () => {
  it('creates the appointment and synchronizes the request in one serializable transaction', async () => {
    const result = await new PrismaAppointmentRepository().create('request', {
      scheduledAt: new Date('2099-08-10T14:00:00.000Z'), durationMinutes: 120, notes: null,
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(mocks.txAppointmentCreate).toHaveBeenCalledBefore(mocks.txRequestUpdate);
    expect(mocks.txRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'request' },
      data: { status: 'SCHEDULED', completedAt: null, cancelledAt: null },
    });
    expect(result).toMatchObject({ outcome: 'created', appointment: { serviceRequest: { status: 'SCHEDULED' } } });
  });

  it('detects overlap while adjacent and cancelled appointments do not block', async () => {
    mocks.txAppointmentFindMany.mockResolvedValueOnce([
      { scheduledAt: new Date('2099-08-10T15:00:00.000Z'), durationMinutes: 60 },
    ]);
    const conflict = await new PrismaAppointmentRepository().create('request', {
      scheduledAt: new Date('2099-08-10T14:00:00.000Z'), durationMinutes: 120, notes: null,
    });
    expect(conflict).toEqual({ outcome: 'time_conflict' });

    mocks.txAppointmentFindMany.mockResolvedValueOnce([]);
    const adjacent = await new PrismaAppointmentRepository().create('request', {
      scheduledAt: new Date('2099-08-10T16:00:00.000Z'), durationMinutes: 60, notes: null,
    });
    expect(adjacent.outcome).toBe('created');
    const conflictQuery = mocks.txAppointmentFindMany.mock.calls.at(-1)?.[0] as {
      where: { status: { not: string } };
    };
    expect(conflictQuery.where.status).toEqual({ not: 'CANCELLED' });
  });

  it('maps period and relational filters with pagination and eager-loaded relationships', async () => {
    await new PrismaAppointmentRepository().list({
      page: 2, limit: 10, status: 'CONFIRMED', serviceRequestId: 'request',
      customerId: 'customer', serviceId: 'service',
      scheduledFrom: new Date('2099-08-01T00:00:00.000Z'),
      scheduledTo: new Date('2099-08-31T23:59:59.000Z'),
      sortBy: 'scheduledAt', sortOrder: 'asc',
    });
    const call = mocks.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>; include: Record<string, unknown>;
      skip: number; take: number; orderBy: Record<string, string>;
    };
    expect(call.where).toMatchObject({
      status: 'CONFIRMED', serviceRequestId: 'request',
      serviceRequest: { customerId: 'customer', serviceId: 'service' },
      scheduledAt: {
        gte: new Date('2099-08-01T00:00:00.000Z'),
        lte: new Date('2099-08-31T23:59:59.000Z'),
      },
    });
    expect(call.include).toHaveProperty('serviceRequest');
    expect(call.orderBy).toEqual({ scheduledAt: 'asc' });
    expect({ skip: call.skip, take: call.take }).toEqual({ skip: 10, take: 10 });
  });

  it('updates appointment and service request status atomically', async () => {
    mocks.txAppointmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txAppointmentFindUniqueOrThrow
      .mockResolvedValueOnce({ serviceRequestId: 'request' })
      .mockResolvedValueOnce({ id: 'appointment', status: 'COMPLETED' });
    const result = await new PrismaAppointmentRepository().updateStatus('appointment', 'IN_PROGRESS', {
      status: 'COMPLETED', startedAt: new Date('2099-08-10T14:00:00.000Z'),
      completedAt: new Date('2099-08-10T15:00:00.000Z'), cancelledAt: null,
      serviceRequestStatus: 'COMPLETED',
    });
    expect(mocks.txAppointmentUpdateMany).toHaveBeenCalledBefore(mocks.txRequestUpdate);
    const requestUpdate = mocks.txRequestUpdate.mock.calls[0]?.[0] as {
      data: { status: string };
    };
    expect(requestUpdate.data.status).toBe('COMPLETED');
    expect(result).toEqual({ outcome: 'updated', appointment: { id: 'appointment', status: 'COMPLETED' } });
  });

  it('propagates a coordinated write failure so Prisma rolls the transaction back', async () => {
    mocks.txAppointmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txAppointmentFindUniqueOrThrow.mockResolvedValueOnce({ serviceRequestId: 'request' });
    mocks.txRequestUpdate.mockRejectedValue(new Error('write failed'));
    await expect(new PrismaAppointmentRepository().updateStatus('appointment', 'IN_PROGRESS', {
      status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(), cancelledAt: null,
      serviceRequestStatus: 'COMPLETED',
    })).rejects.toThrow('write failed');
  });
});
