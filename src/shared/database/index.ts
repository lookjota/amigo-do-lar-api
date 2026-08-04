import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

export const database = new PrismaClient();

export type DatabaseReadinessCheck = () => Promise<void>;

export async function checkDatabaseReadiness(): Promise<void> {
  await database.$queryRaw`SELECT 1`;
}

export function registerDatabaseLifecycle(app: FastifyInstance): void {
  app.addHook('onClose', async () => {
    await database.$disconnect();
  });
}
