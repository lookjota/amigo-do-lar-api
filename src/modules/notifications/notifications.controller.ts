import type { FastifyReply, FastifyRequest } from 'fastify';
import type { NotificationsService } from './notifications.service.js';
import type { ListNotificationsInput } from './notifications.types.js';

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  list = async (request: FastifyRequest<{ Querystring: ListNotificationsInput }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.list(request.user.sub, request.query)); };
  unreadCount = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.countUnread(request.user.sub)); };
  markAsRead = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.markAsRead(request.user.sub, request.params.id)); };
  markAllAsRead = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.markAllAsRead(request.user.sub)); };
}
