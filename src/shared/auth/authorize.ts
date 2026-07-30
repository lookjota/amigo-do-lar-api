import type { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

import { ForbiddenError } from '../errors/http-errors.js';

export function authorize(allowedRoles: readonly UserRole[]) {
  return function authorizeRole(request: FastifyRequest): Promise<void> {
    if (!allowedRoles.includes(request.user.role)) {
      return Promise.reject(new ForbiddenError());
    }

    return Promise.resolve();
  };
}
