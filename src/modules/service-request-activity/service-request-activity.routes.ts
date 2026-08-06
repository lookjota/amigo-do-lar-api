import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { ServiceRequestActivityController } from './service-request-activity.controller.js';
import type { ServiceRequestActivityRepository } from './service-request-activity.repository.js';
import { listActivitySchema } from './service-request-activity.schemas.js';
import { ServiceRequestActivityService } from './service-request-activity.service.js';
import type { ListActivityQuery } from './service-request-activity.types.js';

export function registerServiceRequestActivityRoutes(app: FastifyInstance, repository: ServiceRequestActivityRepository): void {
  const controller = new ServiceRequestActivityController(new ServiceRequestActivityService(repository));
  app.get<{ Params: { id: string }; Querystring: ListActivityQuery }>(
    '/service-requests/:id/activity',
    { schema: listActivitySchema, onRequest: [authenticate, authorize(['ADMIN', 'OPERATOR'])] },
    controller.list,
  );
}
