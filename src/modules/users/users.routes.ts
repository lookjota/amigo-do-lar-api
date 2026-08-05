import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { UsersController } from './users.controller.js';
import type { UserRepository } from './users.repository.js';
import { createUserSchema, getUserSchema, listUsersSchema, resetUserPasswordSchema, updateUserSchema, updateUserStatusSchema } from './users.schemas.js';
import { UsersService } from './users.service.js';
import type { CreateUserInput, ListUsersInput, ResetUserPasswordInput, UpdateUserInput, UpdateUserStatusInput } from './users.types.js';

export function registerUsersRoutes(app: FastifyInstance, repository: UserRepository): void {
  const controller = new UsersController(new UsersService(repository));
  const adminOnly = [authenticate, authorize(['ADMIN'])];
  app.get<{ Querystring: ListUsersInput }>('/users', { schema: listUsersSchema, onRequest: adminOnly }, controller.list);
  app.get<{ Params: { id: string } }>('/users/:id', { schema: getUserSchema, onRequest: adminOnly }, controller.getById);
  app.post<{ Body: CreateUserInput }>('/users', { schema: createUserSchema, onRequest: adminOnly }, controller.create);
  app.patch<{ Params: { id: string }; Body: UpdateUserInput }>('/users/:id', { schema: updateUserSchema, onRequest: adminOnly }, controller.update);
  app.patch<{ Params: { id: string }; Body: UpdateUserStatusInput }>('/users/:id/status', { schema: updateUserStatusSchema, onRequest: adminOnly }, controller.updateStatus);
  app.patch<{ Params: { id: string }; Body: ResetUserPasswordInput }>('/users/:id/password', { schema: resetUserPasswordSchema, onRequest: adminOnly }, controller.resetPassword);
}
