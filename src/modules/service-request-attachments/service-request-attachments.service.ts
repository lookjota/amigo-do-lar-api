import { createHash, randomUUID } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import { AppError } from '../../shared/errors/app-error.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/http-errors.js';
import { normalizeCaption, validateAttachmentFile } from './attachment-validation.js';
import type { AttachmentStorage } from './attachment-storage.js';
import type { AttachmentRepository } from './service-request-attachments.repository.js';
import { ATTACHMENT_DOWNLOAD_EXPIRY_SECONDS, type AttachmentEntity, type AttachmentListResult, type ListAttachmentsInput, type UploadAttachmentInput } from './service-request-attachments.types.js';

const requestNotFound = () => new NotFoundError({ code: 'SERVICE_REQUEST_NOT_FOUND', message: 'Service request not found' });
const attachmentNotFound = () => new NotFoundError({ code: 'ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
const storageError = () => new AppError({ code: 'ATTACHMENT_STORAGE_ERROR', message: 'Attachment storage operation failed', statusCode: 502 });

export class ServiceRequestAttachmentsService {
  constructor(private readonly repository: AttachmentRepository, private readonly storage: AttachmentStorage, private readonly maxSize: number, private readonly logger?: FastifyBaseLogger) {}

  async upload(serviceRequestId: string, actorUserId: string, input: UploadAttachmentInput): Promise<AttachmentEntity> {
    if (!(await this.repository.serviceRequestExists(serviceRequestId))) throw requestNotFound();
    const validated = validateAttachmentFile(input.filename, input.mimeType, input.content, this.maxSize);
    const id = randomUUID();
    const storageKey = `service-requests/${serviceRequestId}/${id}${validated.extension}`;
    try {
      await this.storage.upload({ storageKey, contentType: validated.mimeType, content: input.content });
    } catch {
      throw storageError();
    }
    try {
      return await this.repository.createAtomic({ id, serviceRequestId, uploadedByUserId: actorUserId, category: input.category, originalName: validated.originalName, storageKey, mimeType: validated.mimeType, sizeBytes: input.content.byteLength, checksum: createHash('sha256').update(input.content).digest('hex'), caption: normalizeCaption(input.caption) });
    } catch (error) {
      try { await this.storage.delete(storageKey); }
      catch { this.logger?.error({ attachmentId: id, serviceRequestId }, 'Attachment upload compensation failed'); }
      if (error instanceof AppError) throw error;
      throw new AppError({ code: 'ATTACHMENT_UPLOAD_FAILED', message: 'Attachment upload could not be completed', statusCode: 500 });
    }
  }

  async list(serviceRequestId: string, input: ListAttachmentsInput): Promise<AttachmentListResult> {
    if (!(await this.repository.serviceRequestExists(serviceRequestId))) throw requestNotFound();
    const { data, total } = await this.repository.list(serviceRequestId, input);
    return { data, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async get(serviceRequestId: string, attachmentId: string): Promise<AttachmentEntity> {
    const attachment = await this.repository.find(serviceRequestId, attachmentId);
    if (attachment === null || attachment.isDeleted) throw attachmentNotFound();
    return {
      id: attachment.id, serviceRequestId: attachment.serviceRequestId, category: attachment.category,
      originalName: attachment.originalName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes,
      checksum: attachment.checksum, caption: attachment.caption, createdAt: attachment.createdAt,
      uploadedBy: attachment.uploadedBy,
    };
  }

  async download(serviceRequestId: string, attachmentId: string): Promise<{ url: string; filename: string }> {
    const attachment = await this.repository.find(serviceRequestId, attachmentId);
    if (attachment === null || attachment.isDeleted) throw attachmentNotFound();
    try { return { url: await this.storage.getSignedDownloadUrl(attachment.storageKey, ATTACHMENT_DOWNLOAD_EXPIRY_SECONDS), filename: attachment.originalName }; }
    catch { throw storageError(); }
  }

  async remove(serviceRequestId: string, attachmentId: string, actorUserId: string, role: UserRole): Promise<void> {
    if (role !== 'ADMIN') throw new ForbiddenError({ code: 'ATTACHMENT_ACCESS_DENIED', message: 'Only administrators can remove attachments' });
    const outcome = await this.repository.softDeleteAtomic(serviceRequestId, attachmentId, actorUserId, new Date());
    if (outcome === 'not_found') throw attachmentNotFound();
    if (outcome === 'already_removed') throw new ConflictError({ code: 'ATTACHMENT_ALREADY_REMOVED', message: 'Attachment has already been removed' });
  }
}
