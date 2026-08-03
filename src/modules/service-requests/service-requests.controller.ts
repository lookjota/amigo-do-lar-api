import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ServiceRequestsService } from './service-requests.service.js';
import type { CreateServiceRequestInput, ListServiceRequestsInput, UpdateServiceRequestInput, UpdateServiceRequestStatusInput } from './service-requests.types.js';

interface IdParams { id: string }

export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  create = async (request: FastifyRequest<{ Body: CreateServiceRequestInput }>, reply: FastifyReply): Promise<void> => {
    await reply.status(201).send(await this.service.create(request.body));
  };

  list = async (request: FastifyRequest<{ Querystring: ListServiceRequestsInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.list(request.query));
  };

  getById = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.getById(request.params.id));
  };

  update = async (request: FastifyRequest<{ Params: IdParams; Body: UpdateServiceRequestInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.update(request.params.id, request.body));
  };

  updateStatus = async (request: FastifyRequest<{ Params: IdParams; Body: UpdateServiceRequestStatusInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.updateStatus(request.params.id, request.body));
  };
}
