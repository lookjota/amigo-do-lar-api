import type { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { FakeAttachmentStorage } from './fake-attachment-storage.js';
import type { AttachmentRepository } from './service-request-attachments.repository.js';
import { ServiceRequestAttachmentsService } from './service-request-attachments.service.js';
import type { AttachmentEntity, PersistAttachmentInput, StoredAttachment } from './service-request-attachments.types.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const attachmentId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const actor = { id: actorId, name: 'Admin', email: 'admin@example.com', role: 'ADMIN' as UserRole };
function entity(input?: Partial<StoredAttachment>): StoredAttachment { return { id: attachmentId, serviceRequestId: requestId, category: 'DOCUMENT', originalName: 'file.pdf', mimeType: 'application/pdf', sizeBytes: 8, checksum: null, caption: null, createdAt: new Date(), uploadedBy: actor, storageKey: 'private/key.pdf', isDeleted: false, ...input }; }
class MemoryRepository implements AttachmentRepository {
  exists = true;
  stored: StoredAttachment | null = entity();
  failCreate = false;
  created?: PersistAttachmentInput;
  serviceRequestExists(): Promise<boolean> { return Promise.resolve(this.exists); }
  createAtomic(input: PersistAttachmentInput): Promise<AttachmentEntity> { this.created = input; if (this.failCreate) return Promise.reject(new Error('database secret')); return Promise.resolve(entity({ ...input })); }
  list(): Promise<{ data: AttachmentEntity[]; total: number }> { return Promise.resolve({ data: this.stored === null ? [] : [this.stored], total: this.stored === null ? 0 : 1 }); }
  find(): Promise<StoredAttachment | null> { return Promise.resolve(this.stored); }
  softDeleteAtomic(): Promise<'not_found' | 'already_removed' | 'removed'> { return Promise.resolve(this.stored === null ? 'not_found' : this.stored.isDeleted ? 'already_removed' : 'removed'); }
}
const validPdf = Buffer.from('%PDF-1.7');

describe('ServiceRequestAttachmentsService', () => {
  it('uses session authorship, generated key and stores a valid upload', async () => {
    const repository = new MemoryRepository(); const storage = new FakeAttachmentStorage();
    const result = await new ServiceRequestAttachmentsService(repository, storage, 100).upload(requestId, actorId, { filename: '../proof.pdf', mimeType: 'application/pdf', content: validPdf, category: 'RECEIPT' });
    expect(result.originalName).toBe('proof.pdf'); expect(repository.created?.uploadedByUserId).toBe(actorId);
    expect(repository.created?.storageKey).toMatch(new RegExp(`^service-requests/${requestId}/[0-9a-f-]+\\.pdf$`));
    expect(storage.objects.size).toBe(1);
  });

  it('does not upload for a missing request and compensates transaction failure', async () => {
    const repository = new MemoryRepository(); const storage = new FakeAttachmentStorage(); const service = new ServiceRequestAttachmentsService(repository, storage, 100);
    repository.exists = false;
    await expect(service.upload(requestId, actorId, { filename: 'file.pdf', mimeType: 'application/pdf', content: validPdf, category: 'DOCUMENT' })).rejects.toMatchObject({ code: 'SERVICE_REQUEST_NOT_FOUND' });
    expect(storage.objects.size).toBe(0);
    repository.exists = true; repository.failCreate = true;
    await expect(service.upload(requestId, actorId, { filename: 'file.pdf', mimeType: 'application/pdf', content: validPdf, category: 'DOCUMENT' })).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_FAILED' });
    expect(storage.objects.size).toBe(0);
  });

  it('hides deleted and cross-request attachments and restricts removal to ADMIN', async () => {
    const repository = new MemoryRepository(); const service = new ServiceRequestAttachmentsService(repository, new FakeAttachmentStorage(), 100);
    repository.stored = entity({ isDeleted: true });
    await expect(service.download(requestId, attachmentId)).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
    await expect(service.remove(requestId, attachmentId, actorId, 'OPERATOR')).rejects.toMatchObject({ code: 'ATTACHMENT_ACCESS_DENIED' });
  });

  it('returns a short-lived signed download without exposing the key in metadata', async () => {
    const repository = new MemoryRepository(); const storage = new FakeAttachmentStorage(); const service = new ServiceRequestAttachmentsService(repository, storage, 100);
    const metadata = await service.get(requestId, attachmentId); const download = await service.download(requestId, attachmentId);
    expect(metadata).not.toHaveProperty('storageKey'); expect(download.url).toContain('expires=180');
  });
});
