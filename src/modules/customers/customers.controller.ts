import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CustomersService } from './customers.service.js';
import type {
  CreateCustomerInput,
  ListCustomersInput,
  UpdateCustomerInput,
} from './customers.types.js';

interface IdParams {
  id: string;
}

export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  list = async (
    request: FastifyRequest<{ Querystring: ListCustomersInput }>,
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

  create = async (
    request: FastifyRequest<{ Body: CreateCustomerInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.status(201).send(await this.service.create(request.body));
  };

  update = async (
    request: FastifyRequest<{
      Params: IdParams;
      Body: UpdateCustomerInput;
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.send(
      await this.service.update(
        request.params.id,
        request.body,
        request.user.role,
      ),
    );
  };

  deactivate = async (
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await reply.send(await this.service.deactivate(request.params.id));
  };
}
