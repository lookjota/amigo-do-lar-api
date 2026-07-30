import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import { env } from './config/env.js';
import {
  type AuthRepository,
  PrismaAuthRepository,
} from './modules/auth/auth.repository.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerJwt } from './shared/auth/jwt.js';
import { registerDatabaseLifecycle } from './shared/database/index.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';

interface BuildAppOptions extends FastifyServerOptions {
  authRepository?: AuthRepository;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const { authRepository = new PrismaAuthRepository(), ...serverOptions } =
    options;
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    ...serverOptions,
  });

  registerJwt(app);
  registerDatabaseLifecycle(app);
  registerErrorHandlers(app);
  registerAuthRoutes(app, authRepository);

  app.get('/health', () => {
    return {
      status: 'ok',
    };
  });

  return app;
}
