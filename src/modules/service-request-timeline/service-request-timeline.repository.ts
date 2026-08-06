import type { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import type {
  AppendTimelineEventInput,
  ListTimelineInput,
  TimelineEvent,
} from './service-request-timeline.types.js';
import { createOperationalNotifications } from '../notifications/notifications.repository.js';

const eventSelect = {
  id: true,
  serviceRequestId: true,
  type: true,
  title: true,
  description: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ServiceRequestEventSelect;

export async function appendTimelineEvent(
  transaction: Prisma.TransactionClient,
  input: AppendTimelineEventInput,
): Promise<TimelineEvent> {
  return transaction.serviceRequestEvent.create({
    data: {
      serviceRequestId: input.serviceRequestId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      visibility: 'INTERNAL',
      title: input.title,
      description: input.description ?? null,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
    select: eventSelect,
  });
}

export interface ServiceRequestTimelineRepository {
  serviceRequestExists(serviceRequestId: string): Promise<boolean>;
  list(serviceRequestId: string, input: ListTimelineInput): Promise<{ data: TimelineEvent[]; total: number }>;
  createComment(serviceRequestId: string, actorUserId: string, content: string): Promise<TimelineEvent | null>;
}

export class PrismaServiceRequestTimelineRepository implements ServiceRequestTimelineRepository {
  async serviceRequestExists(serviceRequestId: string): Promise<boolean> {
    return (await database.serviceRequest.findUnique({ where: { id: serviceRequestId }, select: { id: true } })) !== null;
  }

  async list(serviceRequestId: string, input: ListTimelineInput): Promise<{ data: TimelineEvent[]; total: number }> {
    const where: Prisma.ServiceRequestEventWhereInput = {
      serviceRequestId,
      visibility: 'INTERNAL',
      ...(input.type === undefined ? {} : { type: input.type }),
    };
    const [data, total] = await database.$transaction([
      database.serviceRequestEvent.findMany({
        where,
        select: eventSelect,
        orderBy: [{ createdAt: input.sortOrder }, { id: input.sortOrder }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      database.serviceRequestEvent.count({ where }),
    ]);
    return { data, total };
  }

  createComment(serviceRequestId: string, actorUserId: string, content: string): Promise<TimelineEvent | null> {
    return database.$transaction(async (transaction) => {
      const request = await transaction.serviceRequest.findUnique({ where: { id: serviceRequestId }, select: { id: true } });
      if (request === null) return null;
      const event = await appendTimelineEvent(transaction, {
        serviceRequestId,
        actorUserId,
        type: 'COMMENT_ADDED',
        title: 'Comentário interno',
        description: content,
      });
      await createOperationalNotifications(transaction, {
        actorUserId, type: 'COMMENT_ADDED', message: 'Um comentário interno foi adicionado.',
        resourceType: 'SERVICE_REQUEST', resourceId: serviceRequestId, roles: ['ADMIN', 'OPERATOR'],
      });
      return event;
    });
  }
}
