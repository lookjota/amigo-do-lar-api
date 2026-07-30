import type { FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../errors/http-errors.js';

export async function authenticate(
  request: FastifyRequest,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError();
  }
}
