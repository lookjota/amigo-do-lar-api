import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import type { AttachmentStorage } from './attachment-storage.js';
import { ServiceRequestAttachmentsController } from './service-request-attachments.controller.js';
import type { AttachmentRepository } from './service-request-attachments.repository.js';
import { deleteAttachmentSchema, downloadAttachmentSchema, getAttachmentSchema, listAttachmentsSchema, uploadAttachmentSchema } from './service-request-attachments.schemas.js';
import { ServiceRequestAttachmentsService } from './service-request-attachments.service.js';
import type { ListAttachmentsInput } from './service-request-attachments.types.js';

interface RequestParams { id: string }
interface AttachmentParams { serviceRequestId: string; attachmentId: string }

export function registerServiceRequestAttachmentsRoutes(app: FastifyInstance, repository: AttachmentRepository, storage: AttachmentStorage, maxSize: number): void {
  const controller = new ServiceRequestAttachmentsController(new ServiceRequestAttachmentsService(repository, storage, maxSize, app.log), maxSize);
  const staffOnly = [authenticate, authorize(['ADMIN', 'OPERATOR'])];
  app.post<{ Params: RequestParams }>('/service-requests/:id/attachments', { schema: uploadAttachmentSchema, onRequest: staffOnly }, controller.upload);
  app.get<{ Params: RequestParams; Querystring: ListAttachmentsInput }>('/service-requests/:id/attachments', { schema: listAttachmentsSchema, onRequest: staffOnly }, controller.list);
  app.get<{ Params: AttachmentParams }>('/service-requests/:serviceRequestId/attachments/:attachmentId', { schema: getAttachmentSchema, onRequest: staffOnly }, controller.get);
  app.get<{ Params: AttachmentParams }>('/service-requests/:serviceRequestId/attachments/:attachmentId/download', { schema: downloadAttachmentSchema, onRequest: staffOnly }, controller.download);
  app.delete<{ Params: AttachmentParams }>('/service-requests/:serviceRequestId/attachments/:attachmentId', { schema: deleteAttachmentSchema, onRequest: staffOnly }, controller.remove);
}
