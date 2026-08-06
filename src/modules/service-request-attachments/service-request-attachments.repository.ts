import type { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { createOperationalNotifications } from '../notifications/notifications.repository.js';
import { appendTimelineEvent } from '../service-request-timeline/service-request-timeline.repository.js';
import type { AttachmentEntity, ListAttachmentsInput, PersistAttachmentInput, StoredAttachment } from './service-request-attachments.types.js';

const attachmentSelect = {
  id: true, serviceRequestId: true, category: true, originalName: true, mimeType: true,
  sizeBytes: true, checksum: true, caption: true, createdAt: true,
  uploadedBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ServiceRequestAttachmentSelect;
const storedAttachmentSelect = { ...attachmentSelect, storageKey: true, isDeleted: true } satisfies Prisma.ServiceRequestAttachmentSelect;

export interface AttachmentRepository {
  serviceRequestExists(serviceRequestId: string): Promise<boolean>;
  createAtomic(input: PersistAttachmentInput): Promise<AttachmentEntity>;
  list(serviceRequestId: string, input: ListAttachmentsInput): Promise<{ data: AttachmentEntity[]; total: number }>;
  find(serviceRequestId: string, attachmentId: string): Promise<StoredAttachment | null>;
  softDeleteAtomic(serviceRequestId: string, attachmentId: string, actorUserId: string, at: Date): Promise<'not_found' | 'already_removed' | 'removed'>;
}

export class PrismaAttachmentRepository implements AttachmentRepository {
  async serviceRequestExists(serviceRequestId: string): Promise<boolean> {
    return (await database.serviceRequest.findUnique({ where: { id: serviceRequestId }, select: { id: true } })) !== null;
  }

  createAtomic(input: PersistAttachmentInput): Promise<AttachmentEntity> {
    return database.$transaction(async (tx) => {
      const attachment = await tx.serviceRequestAttachment.create({ data: input, select: attachmentSelect });
      await appendTimelineEvent(tx, { serviceRequestId: input.serviceRequestId, actorUserId: input.uploadedByUserId, type: 'ATTACHMENT_ADDED', title: 'Anexo adicionado', description: 'Um anexo foi adicionado à solicitação.', metadata: { attachmentId: input.id, category: input.category, mimeType: input.mimeType } });
      await createOperationalNotifications(tx, { actorUserId: input.uploadedByUserId, type: 'ATTACHMENT_ADDED', message: 'Um novo anexo foi adicionado à solicitação.', resourceType: 'SERVICE_REQUEST', resourceId: input.serviceRequestId, metadata: { attachmentId: input.id, category: input.category }, roles: ['ADMIN', 'OPERATOR'] });
      return attachment;
    });
  }

  async list(serviceRequestId: string, input: ListAttachmentsInput): Promise<{ data: AttachmentEntity[]; total: number }> {
    const where = { serviceRequestId, isDeleted: false, ...(input.category === undefined ? {} : { category: input.category }) } satisfies Prisma.ServiceRequestAttachmentWhereInput;
    const [data, total] = await database.$transaction([
      database.serviceRequestAttachment.findMany({ where, select: attachmentSelect, orderBy: [{ createdAt: input.sortOrder }, { id: input.sortOrder }], skip: (input.page - 1) * input.limit, take: input.limit }),
      database.serviceRequestAttachment.count({ where }),
    ]);
    return { data, total };
  }

  find(serviceRequestId: string, attachmentId: string): Promise<StoredAttachment | null> {
    return database.serviceRequestAttachment.findFirst({ where: { id: attachmentId, serviceRequestId }, select: storedAttachmentSelect });
  }

  softDeleteAtomic(serviceRequestId: string, attachmentId: string, actorUserId: string, at: Date): Promise<'not_found' | 'already_removed' | 'removed'> {
    return database.$transaction(async (tx) => {
      const existing = await tx.serviceRequestAttachment.findFirst({ where: { id: attachmentId, serviceRequestId }, select: { id: true, isDeleted: true, category: true } });
      if (existing === null) return 'not_found';
      if (existing.isDeleted) return 'already_removed';
      const changed = await tx.serviceRequestAttachment.updateMany({ where: { id: attachmentId, serviceRequestId, isDeleted: false }, data: { isDeleted: true, deletedAt: at, deletedByUserId: actorUserId } });
      if (changed.count === 0) return 'already_removed';
      await appendTimelineEvent(tx, { serviceRequestId, actorUserId, type: 'ATTACHMENT_REMOVED', title: 'Anexo removido', description: 'Um anexo foi removido da solicitação.', metadata: { attachmentId, category: existing.category } });
      await createOperationalNotifications(tx, { actorUserId, type: 'ATTACHMENT_REMOVED', message: 'Um anexo foi removido da solicitação.', resourceType: 'SERVICE_REQUEST', resourceId: serviceRequestId, metadata: { attachmentId, category: existing.category }, roles: ['ADMIN', 'OPERATOR'] });
      return 'removed';
    });
  }
}
