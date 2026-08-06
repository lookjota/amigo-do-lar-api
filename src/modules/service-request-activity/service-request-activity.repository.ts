import type { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { eventTypesForCategory } from './service-request-activity.mapper.js';
import type { ActivityEvent, ListActivityRepositoryInput } from './service-request-activity.types.js';

const eventSelect = {
  id: true, serviceRequestId: true, type: true, title: true, description: true,
  metadata: true, createdAt: true,
  actor: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ServiceRequestEventSelect;

export interface ServiceRequestActivityRepository {
  serviceRequestExists(serviceRequestId: string): Promise<boolean>;
  list(serviceRequestId: string, input: ListActivityRepositoryInput): Promise<ActivityEvent[]>;
}

export class PrismaServiceRequestActivityRepository implements ServiceRequestActivityRepository {
  async serviceRequestExists(serviceRequestId: string): Promise<boolean> {
    return (await database.serviceRequest.findUnique({ where: { id: serviceRequestId }, select: { id: true } })) !== null;
  }

  list(serviceRequestId: string, input: ListActivityRepositoryInput): Promise<ActivityEvent[]> {
    const cursorCondition: Prisma.ServiceRequestEventWhereInput | undefined = input.cursor === undefined
      ? undefined
      : input.sortOrder === 'asc'
        ? { OR: [{ createdAt: { gt: input.cursor.createdAt } }, { createdAt: input.cursor.createdAt, id: { gt: input.cursor.id } }] }
        : { OR: [{ createdAt: { lt: input.cursor.createdAt } }, { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } }] };
    const categoryTypes = input.category === undefined ? undefined : eventTypesForCategory(input.category);
    const filters: Prisma.ServiceRequestEventWhereInput[] = [
      ...(input.type === undefined ? [] : [{ type: input.type }]),
      ...(categoryTypes === undefined ? [] : [{ type: { in: categoryTypes } }]),
      ...(cursorCondition === undefined ? [] : [cursorCondition]),
    ];
    const where: Prisma.ServiceRequestEventWhereInput = {
      serviceRequestId, visibility: 'INTERNAL',
      ...(filters.length === 0 ? {} : { AND: filters }),
    };
    return database.serviceRequestEvent.findMany({
      where, select: eventSelect,
      orderBy: [{ createdAt: input.sortOrder }, { id: input.sortOrder }],
      take: input.limit + 1,
    });
  }
}
