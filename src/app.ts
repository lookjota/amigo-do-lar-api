import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import { env } from './config/env.js';

export function buildApp(
  options: FastifyServerOptions = {},
): FastifyInstance {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    ...options,
  });

  app.get('/health', () => {
    return {
      status: 'ok',
    };
  });

  return app;
}
