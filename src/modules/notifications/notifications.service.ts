import { NotFoundError } from '../../shared/errors/http-errors.js';
import type { NotificationRepository } from './notifications.repository.js';
import type { ListNotificationsInput, NotificationEntity, NotificationListResult } from './notifications.types.js';

export class NotificationsService {
  constructor(private readonly repository: NotificationRepository, private readonly now: () => Date = () => new Date()) {}
  async list(userId: string, input: ListNotificationsInput): Promise<NotificationListResult> {
    const { data, total } = await this.repository.listForUser(userId, input);
    return { data, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }
  async countUnread(userId: string): Promise<{ count: number }> { return { count: await this.repository.countUnread(userId) }; }
  async markAsRead(userId: string, id: string): Promise<NotificationEntity> {
    const notification = await this.repository.markAsRead(userId, id, this.now());
    if (notification === null) throw new NotFoundError({ code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' });
    return notification;
  }
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    return { updatedCount: await this.repository.markAllAsRead(userId, this.now()) };
  }
}
