import fastifyJwt from '@fastify/jwt';
import type { UserRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export function registerJwt(app: FastifyInstance): void {
  void app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });
}
