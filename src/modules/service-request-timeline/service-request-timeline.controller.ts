import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ServiceRequestTimelineService } from './service-request-timeline.service.js';
import type { CreateTimelineCommentInput, ListTimelineInput } from './service-request-timeline.types.js';

interface IdParams { id: string }

export class ServiceRequestTimelineController {
  constructor(private readonly service: ServiceRequestTimelineService) {}

  list = async (request: FastifyRequest<{ Params: IdParams; Querystring: ListTimelineInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.list(request.params.id, request.query));
  };

  addComment = async (request: FastifyRequest<{ Params: IdParams; Body: CreateTimelineCommentInput }>, reply: FastifyReply): Promise<void> => {
    await reply.status(201).send(await this.service.addComment(request.params.id, request.user.sub, request.body));
  };
}
