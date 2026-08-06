import { ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT, activityItemTypes, activityResourceTypes } from './service-request-activity.types.js';

export const activityEventTypes = [
  'REQUEST_CREATED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'APPOINTMENT_CREATED',
  'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_STATUS_CHANGED', 'QUOTE_CREATED',
  'QUOTE_STATUS_CHANGED', 'PAYMENT_CREATED', 'PAYMENT_STATUS_CHANGED',
  'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED',
] as const;

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const actor = { anyOf: [{
  type: 'object', additionalProperties: false, required: ['id', 'name', 'email', 'role'],
  properties: {
    id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, email: { type: 'string' },
    role: { type: 'string', enum: ['ADMIN', 'OPERATOR'] },
  },
}, { type: 'null' }] } as const;
const details = { anyOf: [{
  type: 'object', additionalProperties: false,
  properties: {
    from: { type: 'string' }, to: { type: 'string' }, appointmentId: { type: 'string' },
    scheduledAt: { type: 'string' }, scheduledAtFrom: { type: 'string' }, scheduledAtTo: { type: 'string' },
    quoteId: { type: 'string' }, paymentId: { type: 'string' }, attachmentId: { type: 'string' },
    category: { type: 'string' }, mimeType: { type: 'string' },
  },
}, { type: 'null' }] } as const;

const item = {
  type: 'object', additionalProperties: false,
  required: ['id', 'eventType', 'activityType', 'title', 'description', 'createdAt', 'actor', 'resource', 'details'],
  properties: {
    id: { type: 'string', format: 'uuid' }, eventType: { type: 'string', enum: activityEventTypes },
    activityType: { type: 'string', enum: activityItemTypes }, title: { type: 'string' },
    description: nullableString, createdAt: { type: 'string', format: 'date-time' }, actor,
    resource: {
      type: 'object', additionalProperties: false, required: ['type', 'id'],
      properties: { type: { type: 'string', enum: activityResourceTypes }, id: nullableString },
    },
    details,
  },
} as const;

export const listActivitySchema = {
  params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
      limit: { type: 'integer', minimum: 1, maximum: ACTIVITY_MAX_LIMIT, default: ACTIVITY_DEFAULT_LIMIT },
      type: { type: 'string', enum: activityEventTypes }, category: { type: 'string', enum: activityItemTypes },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
  },
  response: { 200: {
    type: 'object', additionalProperties: false, required: ['data', 'pagination'],
    properties: {
      data: { type: 'array', items: item },
      pagination: {
        type: 'object', additionalProperties: false, required: ['nextCursor', 'hasMore', 'limit'],
        properties: { nextCursor: nullableString, hasMore: { type: 'boolean' }, limit: { type: 'integer' } },
      },
    },
  } },
} as const;
