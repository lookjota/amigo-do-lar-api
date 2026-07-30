import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthService } from './auth.service.js';
import type { LoginInput } from './auth.types.js';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.service.login(request.body);
    await reply.send(result);
  };

  me = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const user = await this.service.getAuthenticatedUser(request.user.sub);
    await reply.send(user);
  };
}
