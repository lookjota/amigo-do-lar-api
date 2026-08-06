import { NOTIFICATION_DEFAULT_LIMIT, NOTIFICATION_MAX_LIMIT } from './notifications.types.js';

export const notificationTypes = ['SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_STATUS_CHANGED', 'COMMENT_ADDED', 'APPOINTMENT_CREATED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_STATUS_CHANGED', 'QUOTE_CREATED', 'QUOTE_STATUS_CHANGED', 'PAYMENT_CREATED', 'PAYMENT_STATUS_CHANGED'] as const;
export const notificationResourceTypes = ['SERVICE_REQUEST', 'APPOINTMENT', 'QUOTE', 'PAYMENT'] as const;
const emptyBody = { type: 'object', additionalProperties: false, maxProperties: 0 } as const;
const actor = { anyOf: [{ type: 'object', additionalProperties: false, required: ['id', 'name', 'email', 'role'], properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'OPERATOR'] } } }, { type: 'null' }] } as const;
const notification = { type: 'object', additionalProperties: false, required: ['id', 'type', 'title', 'message', 'resourceType', 'resourceId', 'metadata', 'readAt', 'createdAt', 'actor'], properties: {
  id: { type: 'string', format: 'uuid' }, type: { type: 'string', enum: notificationTypes }, title: { type: 'string' }, message: { type: 'string' }, resourceType: { type: 'string', enum: notificationResourceTypes }, resourceId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] }, metadata: {}, readAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] }, createdAt: { type: 'string', format: 'date-time' }, actor,
} } as const;
const idParams = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;

export const listNotificationsSchema = { querystring: { type: 'object', additionalProperties: false, properties: {
  page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: NOTIFICATION_MAX_LIMIT, default: NOTIFICATION_DEFAULT_LIMIT }, unreadOnly: { type: 'boolean', default: false }, type: { type: 'string', enum: notificationTypes }, resourceType: { type: 'string', enum: notificationResourceTypes }, sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
} }, response: { 200: { type: 'object', additionalProperties: false, required: ['data', 'pagination'], properties: { data: { type: 'array', items: notification }, pagination: { type: 'object', additionalProperties: false, required: ['page', 'limit', 'total', 'totalPages'], properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } } } } } } as const;
export const unreadCountSchema = { response: { 200: { type: 'object', additionalProperties: false, required: ['count'], properties: { count: { type: 'integer' } } } } } as const;
export const markNotificationReadSchema = { params: idParams, body: emptyBody, response: { 200: notification } } as const;
export const markAllNotificationsReadSchema = { body: emptyBody, response: { 200: { type: 'object', additionalProperties: false, required: ['updatedCount'], properties: { updatedCount: { type: 'integer' } } } } } as const;
