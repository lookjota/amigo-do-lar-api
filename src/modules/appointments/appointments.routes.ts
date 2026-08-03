import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { AppointmentsController } from './appointments.controller.js';
import type { AppointmentRepository } from './appointments.repository.js';
import {
  createAppointmentSchema,
  getAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
} from './appointments.schemas.js';
import { AppointmentsService } from './appointments.service.js';
import type {
  CreateAppointmentInput,
  ListAppointmentsInput,
  UpdateAppointmentInput,
  UpdateAppointmentStatusInput,
} from './appointments.types.js';

export function registerAppointmentsRoutes(app: FastifyInstance, repository: AppointmentRepository): void {
  const controller = new AppointmentsController(new AppointmentsService(repository));
  const staffOnly = [authenticate, authorize(['ADMIN', 'OPERATOR'])];

  app.post<{ Body: CreateAppointmentInput }>('/appointments', { schema: createAppointmentSchema, onRequest: staffOnly }, controller.create);
  app.get<{ Querystring: ListAppointmentsInput }>('/appointments', { schema: listAppointmentsSchema, onRequest: staffOnly }, controller.list);
  app.get<{ Params: { id: string } }>('/appointments/:id', { schema: getAppointmentSchema, onRequest: staffOnly }, controller.getById);
  app.patch<{ Params: { id: string }; Body: UpdateAppointmentInput }>('/appointments/:id', { schema: updateAppointmentSchema, onRequest: staffOnly }, controller.update);
  app.patch<{ Params: { id: string }; Body: UpdateAppointmentStatusInput }>('/appointments/:id/status', { schema: updateAppointmentStatusSchema, onRequest: staffOnly }, controller.updateStatus);
}
