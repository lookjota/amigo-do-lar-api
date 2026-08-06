import type { Prisma, ServiceRequestEventType, UserRole } from '@prisma/client';

export const TIMELINE_DEFAULT_LIMIT = 20;
export const TIMELINE_MAX_LIMIT = 100;
export const TIMELINE_COMMENT_MAX_LENGTH = 4_000;

export const EVENT_TITLES = {
  REQUEST_CREATED: 'Solicitação criada',
  STATUS_CHANGED: 'Status alterado',
  COMMENT_ADDED: 'Comentário interno',
  APPOINTMENT_CREATED: 'Agendamento criado',
  APPOINTMENT_RESCHEDULED: 'Agendamento reagendado',
  APPOINTMENT_STATUS_CHANGED: 'Status do agendamento alterado',
  QUOTE_CREATED: 'Orçamento criado',
  QUOTE_STATUS_CHANGED: 'Status do orçamento alterado',
  PAYMENT_CREATED: 'Pagamento registrado',
  PAYMENT_STATUS_CHANGED: 'Status do pagamento alterado',
  ATTACHMENT_ADDED: 'Anexo adicionado',
  ATTACHMENT_REMOVED: 'Anexo removido',
} satisfies Record<ServiceRequestEventType, string>;

export interface TimelineActor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TimelineEvent {
  id: string;
  serviceRequestId: string;
  type: ServiceRequestEventType;
  title: string;
  description: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: TimelineActor | null;
}

export interface AppendTimelineEventInput {
  serviceRequestId: string;
  actorUserId?: string | null | undefined;
  type: ServiceRequestEventType;
  title: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface ListTimelineInput {
  page: number;
  limit: number;
  type?: ServiceRequestEventType;
  sortOrder: 'asc' | 'desc';
}

export interface TimelineListResult {
  data: TimelineEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateTimelineCommentInput { content: string }
