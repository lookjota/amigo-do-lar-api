import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppointmentsService } from './appointments.service.js';
import type {
  CreateAppointmentInput,
  ListAppointmentsInput,
  UpdateAppointmentInput,
  UpdateAppointmentStatusInput,
} from './appointments.types.js';

interface IdParams { id: string }

export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  create = async (
    request: FastifyRequest<{ Body: CreateAppointmentInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.status(201).send(await this.service.create(request.body, request.user.sub));
  };

  list = async (
    request: FastifyRequest<{ Querystring: ListAppointmentsInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.send(await this.service.list(request.query));
  };

  getById = async (
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.send(await this.service.getById(request.params.id));
  };

  update = async (
    request: FastifyRequest<{ Params: IdParams; Body: UpdateAppointmentInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.send(await this.service.update(request.params.id, request.body, request.user.sub));
  };

  updateStatus = async (
    request: FastifyRequest<{ Params: IdParams; Body: UpdateAppointmentStatusInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.send(await this.service.updateStatus(request.params.id, request.body, request.user.sub));
  };
}
