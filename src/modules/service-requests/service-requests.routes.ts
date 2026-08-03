import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { ServiceRequestsController } from './service-requests.controller.js';
import type { ServiceRequestRepository } from './service-requests.repository.js';
import { createServiceRequestSchema, getServiceRequestSchema, listServiceRequestsSchema, updateServiceRequestSchema, updateServiceRequestStatusSchema } from './service-requests.schemas.js';
import { ServiceRequestsService } from './service-requests.service.js';
import type { CreateServiceRequestInput, ListServiceRequestsInput, UpdateServiceRequestInput, UpdateServiceRequestStatusInput } from './service-requests.types.js';

export function registerServiceRequestsRoutes(app: FastifyInstance, repository: ServiceRequestRepository): void {
  const controller = new ServiceRequestsController(new ServiceRequestsService(repository));
  const staffOnly = [authenticate, authorize(['ADMIN', 'OPERATOR'])];

  app.post<{ Body: CreateServiceRequestInput }>('/service-requests', { schema: createServiceRequestSchema }, controller.create);
  app.get<{ Querystring: ListServiceRequestsInput }>('/service-requests', { schema: listServiceRequestsSchema, onRequest: staffOnly }, controller.list);
  app.get<{ Params: { id: string } }>('/service-requests/:id', { schema: getServiceRequestSchema, onRequest: staffOnly }, controller.getById);
  app.patch<{ Params: { id: string }; Body: UpdateServiceRequestInput }>('/service-requests/:id', { schema: updateServiceRequestSchema, onRequest: staffOnly }, controller.update);
  app.patch<{ Params: { id: string }; Body: UpdateServiceRequestStatusInput }>('/service-requests/:id/status', { schema: updateServiceRequestStatusSchema, onRequest: staffOnly }, controller.updateStatus);
}
