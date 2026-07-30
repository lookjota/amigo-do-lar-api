import type { FastifyInstance, FastifyRequest } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import type { ServiceRepository } from './services.repository.js';
import { ServicesController } from './services.controller.js';
import {
  createServiceSchema,
  deactivateServiceSchema,
  getServiceSchema,
  listServicesSchema,
  updateServiceSchema,
} from './services.schemas.js';
import { ServicesService } from './services.service.js';
import type {
  CreateServiceInput,
  ListServicesInput,
  UpdateServiceInput,
} from './services.types.js';

async function authenticateWhenProvided(
  request: FastifyRequest,
): Promise<void> {
  if (request.headers.authorization !== undefined) {
    await authenticate(request);
  }
}

export function registerServicesRoutes(
  app: FastifyInstance,
  repository: ServiceRepository,
): void {
  const controller = new ServicesController(new ServicesService(repository));
  const adminOnly = [authenticate, authorize(['ADMIN'])];

  app.get<{ Querystring: ListServicesInput }>(
    '/services',
    {
      schema: listServicesSchema,
      onRequest: [authenticateWhenProvided],
    },
    controller.list,
  );
  app.get<{ Params: { slug: string } }>(
    '/services/:slug',
    {
      schema: getServiceSchema,
      onRequest: [authenticateWhenProvided],
    },
    controller.getBySlug,
  );
  app.post<{ Body: CreateServiceInput }>(
    '/services',
    { schema: createServiceSchema, onRequest: adminOnly },
    controller.create,
  );
  app.patch<{ Params: { id: string }; Body: UpdateServiceInput }>(
    '/services/:id',
    { schema: updateServiceSchema, onRequest: adminOnly },
    controller.update,
  );
  app.delete<{ Params: { id: string } }>(
    '/services/:id',
    { schema: deactivateServiceSchema, onRequest: adminOnly },
    controller.deactivate,
  );
}
