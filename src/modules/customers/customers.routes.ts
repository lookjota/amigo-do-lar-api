import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { CustomersController } from './customers.controller.js';
import type { CustomerRepository } from './customers.repository.js';
import {
  createCustomerSchema,
  deactivateCustomerSchema,
  getCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customers.schemas.js';
import { CustomersService } from './customers.service.js';
import type {
  CreateCustomerInput,
  ListCustomersInput,
  UpdateCustomerInput,
} from './customers.types.js';

export function registerCustomersRoutes(
  app: FastifyInstance,
  repository: CustomerRepository,
): void {
  const controller = new CustomersController(new CustomersService(repository));
  const staffOnly = [authenticate, authorize(['ADMIN', 'OPERATOR'])];
  const adminOnly = [authenticate, authorize(['ADMIN'])];

  app.get<{ Querystring: ListCustomersInput }>(
    '/customers',
    { schema: listCustomersSchema, onRequest: staffOnly },
    controller.list,
  );
  app.get<{ Params: { id: string } }>(
    '/customers/:id',
    { schema: getCustomerSchema, onRequest: staffOnly },
    controller.getById,
  );
  app.post<{ Body: CreateCustomerInput }>(
    '/customers',
    { schema: createCustomerSchema, onRequest: staffOnly },
    controller.create,
  );
  app.patch<{ Params: { id: string }; Body: UpdateCustomerInput }>(
    '/customers/:id',
    { schema: updateCustomerSchema, onRequest: staffOnly },
    controller.update,
  );
  app.delete<{ Params: { id: string } }>(
    '/customers/:id',
    { schema: deactivateCustomerSchema, onRequest: adminOnly },
    controller.deactivate,
  );
}
