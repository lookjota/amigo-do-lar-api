import type { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import type { CreateOperationalNotificationInput, ListNotificationsInput, NotificationEntity } from './notifications.types.js';
import { NOTIFICATION_TITLES } from './notifications.types.js';

const notificationSelect = {
  id: true, type: true, title: true, message: true, resourceType: true, resourceId: true,
  metadata: true, readAt: true, createdAt: true,
  actor: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.NotificationSelect;

export async function createOperationalNotifications(
  tx: Prisma.TransactionClient,
  input: CreateOperationalNotificationInput,
): Promise<number> {
  const recipients = await tx.user.findMany({
    where: { isActive: true, role: { in: [...input.roles] }, ...(input.actorUserId == null ? {} : { id: { not: input.actorUserId } }) },
    select: { id: true },
  });
  if (recipients.length === 0) return 0;
  const result = await tx.notification.createMany({ data: recipients.map(({ id }) => ({
    recipientUserId: id, actorUserId: input.actorUserId ?? null, type: input.type,
    title: NOTIFICATION_TITLES[input.type], message: input.message,
    resourceType: input.resourceType, resourceId: input.resourceId ?? null,
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  })) });
  return result.count;
}

export interface NotificationRepository {
  listForUser(userId: string, input: ListNotificationsInput): Promise<{ data: NotificationEntity[]; total: number }>;
  countUnread(userId: string): Promise<number>;
  markAsRead(userId: string, notificationId: string, at: Date): Promise<NotificationEntity | null>;
  markAllAsRead(userId: string, at: Date): Promise<number>;
}

export class PrismaNotificationRepository implements NotificationRepository {
  async listForUser(userId: string, input: ListNotificationsInput): Promise<{ data: NotificationEntity[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId, ...(input.unreadOnly === true ? { readAt: null } : {}),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.resourceType === undefined ? {} : { resourceType: input.resourceType }),
    };
    const [data, total] = await database.$transaction([
      database.notification.findMany({ where, select: notificationSelect, orderBy: [{ createdAt: input.sortOrder }, { id: input.sortOrder }], skip: (input.page - 1) * input.limit, take: input.limit }),
      database.notification.count({ where }),
    ]);
    return { data, total };
  }
  countUnread(userId: string): Promise<number> {
    return database.notification.count({ where: { recipientUserId: userId, readAt: null } });
  }
  async markAsRead(userId: string, notificationId: string, at: Date): Promise<NotificationEntity | null> {
    return database.$transaction(async (tx) => {
      const existing = await tx.notification.findFirst({ where: { id: notificationId, recipientUserId: userId }, select: notificationSelect });
      if (existing === null || existing.readAt !== null) return existing;
      await tx.notification.updateMany({ where: { id: notificationId, recipientUserId: userId, readAt: null }, data: { readAt: at } });
      return tx.notification.findFirst({ where: { id: notificationId, recipientUserId: userId }, select: notificationSelect });
    });
  }
  async markAllAsRead(userId: string, at: Date): Promise<number> {
    return (await database.notification.updateMany({ where: { recipientUserId: userId, readAt: null }, data: { readAt: at } })).count;
  }
}
