import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';

const allowedOrigins = new Set(env.CORS_ORIGINS);

export function registerCors(app: FastifyInstance): void {
  void app.register(fastifyCors, {
    origin: (origin, callback) => {
      callback(null, origin !== undefined && allowedOrigins.has(origin));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
