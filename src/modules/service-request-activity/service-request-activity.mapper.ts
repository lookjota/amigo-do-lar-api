import type { ServiceRequestEventType } from '@prisma/client';

import type {
  ActivityDetails, ActivityEvent, ActivityItem, ActivityItemType, ActivityResourceType,
} from './service-request-activity.types.js';

const typeMap = {
  REQUEST_CREATED: 'REQUEST', STATUS_CHANGED: 'STATUS', COMMENT_ADDED: 'COMMENT',
  APPOINTMENT_CREATED: 'APPOINTMENT', APPOINTMENT_RESCHEDULED: 'APPOINTMENT',
  APPOINTMENT_STATUS_CHANGED: 'APPOINTMENT', QUOTE_CREATED: 'QUOTE',
  QUOTE_STATUS_CHANGED: 'QUOTE', PAYMENT_CREATED: 'PAYMENT',
  PAYMENT_STATUS_CHANGED: 'PAYMENT', ATTACHMENT_ADDED: 'ATTACHMENT',
  ATTACHMENT_REMOVED: 'ATTACHMENT',
} satisfies Record<ServiceRequestEventType, ActivityItemType>;

const resourceMap = {
  REQUEST: 'SERVICE_REQUEST', STATUS: 'SERVICE_REQUEST', COMMENT: 'SERVICE_REQUEST',
  APPOINTMENT: 'APPOINTMENT', QUOTE: 'QUOTE', PAYMENT: 'PAYMENT', ATTACHMENT: 'ATTACHMENT',
} satisfies Record<ActivityItemType, ActivityResourceType>;

const detailKeys = {
  REQUEST_CREATED: [], STATUS_CHANGED: ['from', 'to'], COMMENT_ADDED: [],
  APPOINTMENT_CREATED: ['appointmentId', 'scheduledAt'],
  APPOINTMENT_RESCHEDULED: ['appointmentId', 'scheduledAtFrom', 'scheduledAtTo'],
  APPOINTMENT_STATUS_CHANGED: ['appointmentId', 'from', 'to'],
  QUOTE_CREATED: ['quoteId'], QUOTE_STATUS_CHANGED: ['quoteId', 'from', 'to'],
  PAYMENT_CREATED: ['paymentId', 'quoteId'],
  PAYMENT_STATUS_CHANGED: ['paymentId', 'quoteId', 'from', 'to'],
  ATTACHMENT_ADDED: ['attachmentId', 'category', 'mimeType'],
  ATTACHMENT_REMOVED: ['attachmentId', 'category'],
} satisfies Record<ServiceRequestEventType, readonly string[]>;

function objectMetadata(value: ActivityEvent['metadata']): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function sanitizedDetails(event: ActivityEvent): ActivityDetails | null {
  const metadata = objectMetadata(event.metadata);
  if (metadata === null) return null;
  const details: Record<string, string> = {};
  for (const key of detailKeys[event.type]) {
    const value = metadata[key];
    if (typeof value === 'string') details[key] = value;
  }
  return Object.keys(details).length === 0 ? null : details;
}

function resourceId(event: ActivityEvent, activityType: ActivityItemType, details: ActivityDetails | null): string | null {
  if (activityType === 'REQUEST' || activityType === 'STATUS' || activityType === 'COMMENT') return event.serviceRequestId;
  const key = activityType === 'APPOINTMENT' ? 'appointmentId'
    : activityType === 'QUOTE' ? 'quoteId'
      : activityType === 'PAYMENT' ? 'paymentId' : 'attachmentId';
  return details?.[key] ?? null;
}

export function mapActivityEvent(event: ActivityEvent): ActivityItem {
  const activityType = typeMap[event.type];
  const details = sanitizedDetails(event);
  return {
    id: event.id, eventType: event.type, activityType, title: event.title,
    description: event.description, createdAt: event.createdAt, actor: event.actor,
    resource: { type: resourceMap[activityType], id: resourceId(event, activityType, details) },
    details,
  };
}

export function eventTypesForCategory(category: ActivityItemType): ServiceRequestEventType[] {
  return (Object.entries(typeMap) as [ServiceRequestEventType, ActivityItemType][])
    .filter(([, value]) => value === category).map(([type]) => type);
}
