import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { ServiceRequestTimelineController } from './service-request-timeline.controller.js';
import type { ServiceRequestTimelineRepository } from './service-request-timeline.repository.js';
import { addTimelineCommentSchema, listTimelineSchema } from './service-request-timeline.schemas.js';
import { ServiceRequestTimelineService } from './service-request-timeline.service.js';
import type { CreateTimelineCommentInput, ListTimelineInput } from './service-request-timeline.types.js';

export function registerServiceRequestTimelineRoutes(app: FastifyInstance, repository: ServiceRequestTimelineRepository): void {
  const controller = new ServiceRequestTimelineController(new ServiceRequestTimelineService(repository));
  const staffOnly = [authenticate, authorize(['ADMIN', 'OPERATOR'])];
  app.get<{ Params: { id: string }; Querystring: ListTimelineInput }>('/service-requests/:id/timeline', { schema: listTimelineSchema, onRequest: staffOnly }, controller.list);
  app.post<{ Params: { id: string }; Body: CreateTimelineCommentInput }>('/service-requests/:id/comments', { schema: addTimelineCommentSchema, onRequest: staffOnly }, controller.addComment);
}
