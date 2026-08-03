import {
  APPOINTMENT_DEFAULT_LIMIT,
  APPOINTMENT_MAX_DURATION_MINUTES,
  APPOINTMENT_MAX_LIMIT,
  APPOINTMENT_MIN_DURATION_MINUTES,
  APPOINTMENT_NOTES_MAX_LENGTH,
} from './appointments.types.js';

const statuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const nullableDate = { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] } as const;
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const idParams = {
  type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const customerSummary = {
  type: 'object', additionalProperties: false,
  required: ['id', 'name', 'phone', 'email'],
  properties: {
    id: { type: 'string', format: 'uuid' }, name: { type: 'string' },
    phone: { type: 'string' }, email: nullableString,
  },
} as const;

const serviceSummary = {
  type: 'object', additionalProperties: false,
  required: ['id', 'name', 'slug', 'category'],
  properties: {
    id: { type: 'string', format: 'uuid' }, name: { type: 'string' },
    slug: { type: 'string' }, category: { type: 'string' },
  },
} as const;

const serviceRequestSummary = {
  type: 'object', additionalProperties: false,
  required: ['id', 'customerId', 'serviceId', 'description', 'status', 'preferredDate', 'address', 'city', 'customer', 'service'],
  properties: {
    id: { type: 'string', format: 'uuid' }, customerId: { type: 'string', format: 'uuid' },
    serviceId: { type: 'string', format: 'uuid' }, description: { type: 'string' },
    status: { type: 'string', enum: ['PENDING', 'CONTACTED', 'QUOTED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    preferredDate: nullableDate, address: nullableString, city: nullableString,
    customer: customerSummary, service: serviceSummary,
  },
} as const;

const appointmentResponse = {
  type: 'object', additionalProperties: false,
  required: ['id', 'serviceRequestId', 'scheduledAt', 'durationMinutes', 'status', 'notes', 'startedAt', 'completedAt', 'cancelledAt', 'createdAt', 'updatedAt', 'serviceRequest'],
  properties: {
    id: { type: 'string', format: 'uuid' }, serviceRequestId: { type: 'string', format: 'uuid' },
    scheduledAt: { type: 'string', format: 'date-time' },
    durationMinutes: { type: 'integer' }, status: { type: 'string', enum: statuses },
    notes: nullableString, startedAt: nullableDate, completedAt: nullableDate, cancelledAt: nullableDate,
    createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
    serviceRequest: serviceRequestSummary,
  },
} as const;

const scheduleProperties = {
  scheduledAt: { type: 'string', format: 'date-time' },
  durationMinutes: { type: 'integer', minimum: APPOINTMENT_MIN_DURATION_MINUTES, maximum: APPOINTMENT_MAX_DURATION_MINUTES },
  notes: { anyOf: [{ type: 'string', maxLength: APPOINTMENT_NOTES_MAX_LENGTH }, { type: 'null' }] },
} as const;

export const createAppointmentSchema = {
  body: {
    type: 'object', additionalProperties: false,
    required: ['serviceRequestId', 'scheduledAt', 'durationMinutes'],
    properties: { serviceRequestId: { type: 'string', format: 'uuid' }, ...scheduleProperties },
  },
  response: { 201: appointmentResponse },
} as const;

export const listAppointmentsSchema = {
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: APPOINTMENT_MAX_LIMIT, default: APPOINTMENT_DEFAULT_LIMIT },
      status: { type: 'string', enum: statuses },
      serviceRequestId: { type: 'string', format: 'uuid' },
      customerId: { type: 'string', format: 'uuid' }, serviceId: { type: 'string', format: 'uuid' },
      scheduledFrom: { type: 'string', format: 'date-time' }, scheduledTo: { type: 'string', format: 'date-time' },
      sortBy: { type: 'string', enum: ['scheduledAt', 'createdAt', 'updatedAt', 'status'], default: 'scheduledAt' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
    },
  },
  response: {
    200: {
      type: 'object', additionalProperties: false, required: ['data', 'pagination'],
      properties: {
        data: { type: 'array', items: appointmentResponse },
        pagination: {
          type: 'object', additionalProperties: false, required: ['page', 'limit', 'total', 'totalPages'],
          properties: {
            page: { type: 'integer' }, limit: { type: 'integer' },
            total: { type: 'integer' }, totalPages: { type: 'integer' },
          },
        },
      },
    },
  },
} as const;

export const getAppointmentSchema = { params: idParams, response: { 200: appointmentResponse } } as const;

export const updateAppointmentSchema = {
  params: idParams,
  body: {
    type: 'object', additionalProperties: false, minProperties: 1,
    properties: scheduleProperties,
  },
  response: { 200: appointmentResponse },
} as const;

export const updateAppointmentStatusSchema = {
  params: idParams,
  body: {
    type: 'object', additionalProperties: false, required: ['status'],
    properties: { status: { type: 'string', enum: statuses } },
  },
  response: { 200: appointmentResponse },
} as const;
