import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';
import { authenticate } from '../../shared/auth/authenticate.js';
import type { AuthRepository } from './auth.repository.js';
import { AuthController } from './auth.controller.js';
import { loginSchema, meSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

export function registerAuthRoutes(
  app: FastifyInstance,
  repository: AuthRepository,
): void {
  const service = new AuthService(
    repository,
    {
      sign: (payload) => app.jwt.sign(payload),
    },
    env.JWT_EXPIRES_IN,
  );
  const controller = new AuthController(service);

  app.post('/auth/login', { schema: loginSchema }, controller.login);
  app.get(
    '/auth/me',
    {
      schema: meSchema,
      onRequest: [authenticate],
    },
    controller.me,
  );
}
