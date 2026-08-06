import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), txCreate: vi.fn(), txFindFirst: vi.fn(), txUpdateMany: vi.fn(), txEventCreate: vi.fn(), txUserFind: vi.fn(), txNotificationCreate: vi.fn() }));
vi.mock('../../shared/database/index.js', () => ({ database: { $transaction: mocks.transaction, serviceRequestAttachment: { findMany: mocks.findMany, count: mocks.count, findFirst: mocks.findFirst }, serviceRequest: { findUnique: vi.fn() } } }));
import { PrismaAttachmentRepository } from './service-request-attachments.repository.js';

const tx = { serviceRequestAttachment: { create: mocks.txCreate, findFirst: mocks.txFindFirst, updateMany: mocks.txUpdateMany }, serviceRequestEvent: { create: mocks.txEventCreate }, user: { findMany: mocks.txUserFind }, notification: { createMany: mocks.txNotificationCreate } };
beforeEach(() => { vi.clearAllMocks(); mocks.transaction.mockImplementation((argument: unknown) => typeof argument === 'function' ? Promise.resolve((argument as (client: typeof tx) => unknown)(tx)) : Promise.all(argument as Promise<unknown>[])); mocks.txEventCreate.mockResolvedValue({ id: 'event' }); mocks.txUserFind.mockResolvedValue([]); });

describe('PrismaAttachmentRepository', () => {
  it('lists only active attachments with category and pagination', async () => {
    mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
    await new PrismaAttachmentRepository().list('request', { page: 2, limit: 5, category: 'RECEIPT', sortOrder: 'asc' });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { serviceRequestId: 'request', isDeleted: false, category: 'RECEIPT' }, skip: 5, take: 5 }));
  });

  it('creates metadata, timeline and notifications in one transaction', async () => {
    mocks.txCreate.mockResolvedValue({ id: 'attachment' });
    await new PrismaAttachmentRepository().createAtomic({ id: 'attachment', serviceRequestId: 'request', uploadedByUserId: 'actor', category: 'DOCUMENT', originalName: 'file.pdf', storageKey: 'safe-key', mimeType: 'application/pdf', sizeBytes: 5, checksum: 'hash', caption: null });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function)); expect(mocks.txCreate).toHaveBeenCalledBefore(mocks.txEventCreate);
    const eventCall = mocks.txEventCreate.mock.calls[0]?.[0] as { data: { metadata: unknown } };
    expect(eventCall.data.metadata).toEqual({ attachmentId: 'attachment', category: 'DOCUMENT', mimeType: 'application/pdf' });
  });

  it('soft deletes conditionally and reports repeated removal', async () => {
    mocks.txFindFirst.mockResolvedValue({ id: 'attachment', isDeleted: false, category: 'OTHER' }); mocks.txUpdateMany.mockResolvedValue({ count: 1 });
    expect(await new PrismaAttachmentRepository().softDeleteAtomic('request', 'attachment', 'actor', new Date())).toBe('removed');
    expect(mocks.txUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'attachment', serviceRequestId: 'request', isDeleted: false } }));
    mocks.txFindFirst.mockResolvedValue({ id: 'attachment', isDeleted: true, category: 'OTHER' });
    expect(await new PrismaAttachmentRepository().softDeleteAtomic('request', 'attachment', 'actor', new Date())).toBe('already_removed');
  });
});
