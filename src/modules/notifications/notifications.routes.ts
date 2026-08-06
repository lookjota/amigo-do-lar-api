import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { NotificationsController } from './notifications.controller.js';
import type { NotificationRepository } from './notifications.repository.js';
import { listNotificationsSchema, markAllNotificationsReadSchema, markNotificationReadSchema, unreadCountSchema } from './notifications.schemas.js';
import { NotificationsService } from './notifications.service.js';
import type { ListNotificationsInput } from './notifications.types.js';

export function registerNotificationsRoutes(app: FastifyInstance, repository: NotificationRepository): void {
  const controller = new NotificationsController(new NotificationsService(repository));
  const staffOnly = [authenticate, authorize(['ADMIN', 'OPERATOR'])];
  app.get<{ Querystring: ListNotificationsInput }>('/notifications', { schema: listNotificationsSchema, onRequest: staffOnly }, controller.list);
  app.get('/notifications/unread-count', { schema: unreadCountSchema, onRequest: staffOnly }, controller.unreadCount);
  app.patch('/notifications/read-all', { schema: markAllNotificationsReadSchema, onRequest: staffOnly }, controller.markAllAsRead);
  app.patch<{ Params: { id: string } }>('/notifications/:id/read', { schema: markNotificationReadSchema, onRequest: staffOnly }, controller.markAsRead);
}
