import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import { env } from './config/env.js';
import { registerDatabaseLifecycle } from './shared/database/index.js';

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    ...options,
  });

  registerDatabaseLifecycle(app);

  app.get('/health', () => {
    return {
      status: 'ok',
    };
  });

  return app;
}
