import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ServicesService } from './services.service.js';
import type {
  CreateServiceInput,
  ListServicesInput,
  UpdateServiceInput,
} from './services.types.js';

interface IdParams {
  id: string;
}

interface SlugParams {
  slug: string;
}

export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  list = async (
    request: FastifyRequest<{ Querystring: ListServicesInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.service.list(
      request.query,
      request.headers.authorization !== undefined,
    );
    await reply.send(result);
  };

  getBySlug = async (
    request: FastifyRequest<{ Params: SlugParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.service.getBySlug(
      request.params.slug,
      request.headers.authorization !== undefined,
    );
    await reply.send(result);
  };

  create = async (
    request: FastifyRequest<{ Body: CreateServiceInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.service.create(request.body);
    await reply.status(201).send(result);
  };

  update = async (
    request: FastifyRequest<{
      Params: IdParams;
      Body: UpdateServiceInput;
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.service.update(request.params.id, request.body);
    await reply.send(result);
  };

  deactivate = async (
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.service.deactivate(request.params.id);
    await reply.send(result);
  };
}
