import type { NotificationResourceType, NotificationType, Prisma, UserRole } from '@prisma/client';

export const NOTIFICATION_DEFAULT_LIMIT = 20;
export const NOTIFICATION_MAX_LIMIT = 100;

export const NOTIFICATION_TITLES = {
  SERVICE_REQUEST_CREATED: 'Nova solicitação recebida',
  SERVICE_REQUEST_STATUS_CHANGED: 'Status da solicitação alterado',
  COMMENT_ADDED: 'Novo comentário interno',
  APPOINTMENT_CREATED: 'Novo agendamento criado',
  APPOINTMENT_RESCHEDULED: 'Agendamento reagendado',
  APPOINTMENT_STATUS_CHANGED: 'Status do agendamento alterado',
  QUOTE_CREATED: 'Novo orçamento criado',
  QUOTE_STATUS_CHANGED: 'Status do orçamento alterado',
  PAYMENT_CREATED: 'Novo pagamento registrado',
  PAYMENT_STATUS_CHANGED: 'Status do pagamento alterado',
  ATTACHMENT_ADDED: 'Novo anexo adicionado',
  ATTACHMENT_REMOVED: 'Anexo removido',
} satisfies Record<NotificationType, string>;

export interface NotificationActor { id: string; name: string; email: string; role: UserRole }
export interface NotificationEntity {
  id: string; type: NotificationType; title: string; message: string;
  resourceType: NotificationResourceType; resourceId: string | null;
  metadata: Prisma.JsonValue | null; readAt: Date | null; createdAt: Date;
  actor: NotificationActor | null;
}
export interface ListNotificationsInput {
  page: number; limit: number; unreadOnly?: boolean; type?: NotificationType;
  resourceType?: NotificationResourceType; sortOrder: 'asc' | 'desc';
}
export interface NotificationListResult {
  data: NotificationEntity[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface CreateOperationalNotificationInput {
  actorUserId?: string | null | undefined; type: NotificationType; message: string;
  resourceType: NotificationResourceType; resourceId?: string | null;
  metadata?: Prisma.InputJsonValue; roles: readonly UserRole[];
}
