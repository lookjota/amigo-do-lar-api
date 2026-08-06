import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { FakeAttachmentStorage } from './fake-attachment-storage.js';
import type { AttachmentRepository } from './service-request-attachments.repository.js';
import type { AttachmentEntity, PersistAttachmentInput, StoredAttachment } from './service-request-attachments.types.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const attachmentId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const base = { id: attachmentId, serviceRequestId: requestId, category: 'DOCUMENT' as const, originalName: 'proof.pdf', mimeType: 'application/pdf', sizeBytes: 8, checksum: 'checksum', caption: null, createdAt: new Date('2026-08-06T12:00:00Z'), uploadedBy: { id: userId, name: 'Admin', email: 'admin@example.com', role: 'ADMIN' as const } };
class MemoryRepository implements AttachmentRepository {
  item: StoredAttachment | null = { ...base, storageKey: `service-requests/${requestId}/${attachmentId}.pdf`, isDeleted: false };
  serviceRequestExists(): Promise<boolean> { return Promise.resolve(true); }
  createAtomic(input: PersistAttachmentInput): Promise<AttachmentEntity> { this.item = { ...base, ...input, uploadedBy: base.uploadedBy, createdAt: base.createdAt, isDeleted: false }; return Promise.resolve(this.item); }
  list(): Promise<{ data: AttachmentEntity[]; total: number }> { return Promise.resolve({ data: this.item === null ? [] : [this.item], total: this.item === null ? 0 : 1 }); }
  find(serviceRequestId: string, id: string): Promise<StoredAttachment | null> { return Promise.resolve(this.item?.serviceRequestId === serviceRequestId && this.item.id === id ? this.item : null); }
  softDeleteAtomic(): Promise<'removed'> { return Promise.resolve('removed'); }
}
const apps = new Set<FastifyInstance>();
afterEach(async () => { await Promise.all([...apps].map((app) => app.close())); apps.clear(); });
async function setup(role: 'ADMIN' | 'OPERATOR') { const repository = new MemoryRepository(); const storage = new FakeAttachmentStorage(); const app = buildApp({ logger: false, attachmentRepository: repository, attachmentStorage: storage }); apps.add(app); await app.ready(); return { app, headers: { authorization: `Bearer ${app.jwt.sign({ sub: userId, role })}` } }; }
function multipart(fields: Array<{ name: string; value: string; filename?: string; type?: string }>) { const boundary = '----attachment-test'; const chunks = fields.map((field) => `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"${field.filename === undefined ? '' : `; filename="${field.filename}"`}\r\n${field.type === undefined ? '' : `Content-Type: ${field.type}\r\n`}\r\n${field.value}\r\n`).join('') + `--${boundary}--\r\n`; return { payload: Buffer.from(chunks, 'binary'), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }; }

describe('service request attachment routes', () => {
  it('requires authentication and uploads valid multipart for staff', async () => {
    const { app, headers } = await setup('OPERATOR');
    expect((await app.inject({ method: 'GET', url: `/service-requests/${requestId}/attachments` })).statusCode).toBe(401);
    const body = multipart([{ name: 'category', value: 'DOCUMENT' }, { name: 'file', filename: 'proof.pdf', type: 'application/pdf', value: '%PDF-1.7' }]);
    const response = await app.inject({ method: 'POST', url: `/service-requests/${requestId}/attachments`, headers: { ...headers, ...body.headers }, payload: body.payload });
    expect(response.statusCode).toBe(201); expect(response.json()).toMatchObject({ originalName: 'proof.pdf', category: 'DOCUMENT', uploadedBy: { id: userId } }); expect(response.body).not.toContain('storageKey');
  });

  it('lists, gets and redirects downloads with safe headers', async () => {
    const { app, headers } = await setup('ADMIN');
    expect((await app.inject({ method: 'GET', url: `/service-requests/${requestId}/attachments?page=1&limit=5&sortOrder=asc`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/service-requests/${requestId}/attachments/${attachmentId}`, headers })).statusCode).toBe(200);
    const download = await app.inject({ method: 'GET', url: `/service-requests/${requestId}/attachments/${attachmentId}/download`, headers });
    expect(download.statusCode).toBe(302); expect(download.headers['content-disposition']).toContain('attachment;'); expect(download.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects unexpected fields and allows removal only for ADMIN', async () => {
    const operator = await setup('OPERATOR'); const body = multipart([{ name: 'category', value: 'DOCUMENT' }, { name: 'extra', value: 'no' }, { name: 'file', filename: 'proof.pdf', type: 'application/pdf', value: '%PDF-1.7' }]);
    expect((await operator.app.inject({ method: 'POST', url: `/service-requests/${requestId}/attachments`, headers: { ...operator.headers, ...body.headers }, payload: body.payload })).statusCode).toBe(400);
    expect((await operator.app.inject({ method: 'DELETE', url: `/service-requests/${requestId}/attachments/${attachmentId}`, headers: operator.headers })).statusCode).toBe(403);
    const admin = await setup('ADMIN'); expect((await admin.app.inject({ method: 'DELETE', url: `/service-requests/${requestId}/attachments/${attachmentId}`, headers: admin.headers })).statusCode).toBe(204);
  });
});
