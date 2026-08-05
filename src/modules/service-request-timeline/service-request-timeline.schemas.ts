import { TIMELINE_COMMENT_MAX_LENGTH, TIMELINE_DEFAULT_LIMIT, TIMELINE_MAX_LIMIT } from './service-request-timeline.types.js';

export const timelineEventTypes = [
  'REQUEST_CREATED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'APPOINTMENT_CREATED',
  'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_STATUS_CHANGED', 'QUOTE_CREATED',
  'QUOTE_STATUS_CHANGED', 'PAYMENT_CREATED', 'PAYMENT_STATUS_CHANGED',
] as const;

const params = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const actor = {
  anyOf: [{
    type: 'object', additionalProperties: false, required: ['id', 'name', 'email', 'role'],
    properties: {
      id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, email: { type: 'string' },
      role: { type: 'string', enum: ['ADMIN', 'OPERATOR'] },
    },
  }, { type: 'null' }],
} as const;
const event = {
  type: 'object', additionalProperties: false,
  required: ['id', 'serviceRequestId', 'type', 'title', 'description', 'metadata', 'createdAt', 'actor'],
  properties: {
    id: { type: 'string', format: 'uuid' }, serviceRequestId: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: timelineEventTypes }, title: { type: 'string' }, description: nullableString,
    metadata: {}, createdAt: { type: 'string', format: 'date-time' }, actor,
  },
} as const;

export const listTimelineSchema = {
  params,
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: TIMELINE_MAX_LIMIT, default: TIMELINE_DEFAULT_LIMIT },
      type: { type: 'string', enum: timelineEventTypes },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
  },
  response: { 200: {
    type: 'object', additionalProperties: false, required: ['data', 'pagination'],
    properties: {
      data: { type: 'array', items: event },
      pagination: { type: 'object', additionalProperties: false, required: ['page', 'limit', 'total', 'totalPages'], properties: {
        page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' },
      } },
    },
  } },
} as const;

export const addTimelineCommentSchema = {
  params,
  body: {
    type: 'object', additionalProperties: false, required: ['content'],
    properties: { content: { type: 'string', minLength: 1, maxLength: TIMELINE_COMMENT_MAX_LENGTH } },
  },
  response: { 201: event },
} as const;
