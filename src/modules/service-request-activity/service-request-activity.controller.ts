import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ServiceRequestActivityService } from './service-request-activity.service.js';
import type { ListActivityQuery } from './service-request-activity.types.js';

export class ServiceRequestActivityController {
  constructor(private readonly service: ServiceRequestActivityService) {}

  list = async (request: FastifyRequest<{ Params: { id: string }; Querystring: ListActivityQuery }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.list(request.params.id, request.query));
  };
}
