import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UsersService } from './users.service.js';
import type { CreateUserInput, ListUsersInput, ResetUserPasswordInput, UpdateUserInput, UpdateUserStatusInput } from './users.types.js';

interface IdParams { id: string }
export class UsersController {
  constructor(private readonly service: UsersService) {}
  list = async (request: FastifyRequest<{ Querystring: ListUsersInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.list(request.query, request.user.sub));
  };
  getById = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.getById(request.params.id, request.user.sub));
  };
  create = async (request: FastifyRequest<{ Body: CreateUserInput }>, reply: FastifyReply): Promise<void> => {
    await reply.status(201).send(await this.service.create(request.body, request.user.sub));
  };
  update = async (request: FastifyRequest<{ Params: IdParams; Body: UpdateUserInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.update(request.params.id, request.body, request.user.sub));
  };
  updateStatus = async (request: FastifyRequest<{ Params: IdParams; Body: UpdateUserStatusInput }>, reply: FastifyReply): Promise<void> => {
    await reply.send(await this.service.updateStatus(request.params.id, request.body, request.user.sub));
  };
  resetPassword = async (request: FastifyRequest<{ Params: IdParams; Body: ResetUserPasswordInput }>, reply: FastifyReply): Promise<void> => {
    await this.service.resetPassword(request.params.id, request.body, request.user.sub);
    await reply.status(204).send();
  };
}
