import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

export const database = new PrismaClient();

export function registerDatabaseLifecycle(app: FastifyInstance): void {
  app.addHook('onClose', async () => {
    await database.$disconnect();
  });
}
