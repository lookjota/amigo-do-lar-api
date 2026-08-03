import {
  SERVICE_REQUEST_ADDRESS_MAX_LENGTH,
  SERVICE_REQUEST_CITY_MAX_LENGTH,
  SERVICE_REQUEST_DEFAULT_LIMIT,
  SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH,
  SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH,
  SERVICE_REQUEST_INTERNAL_NOTES_MAX_LENGTH,
  SERVICE_REQUEST_MAX_LIMIT,
} from './service-requests.types.js';

const statuses = ['PENDING', 'CONTACTED', 'QUOTED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const nullableDate = { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] } as const;
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const idParams = {
  type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const customerSummary = {
  type: 'object', additionalProperties: false,
  required: ['id', 'name', 'phone', 'email', 'isActive'],
  properties: {
    id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, phone: { type: 'string' },
    email: nullableString, isActive: { type: 'boolean' },
  },
} as const;

const serviceSummary = {
  type: 'object', additionalProperties: false,
  required: ['id', 'name', 'slug', 'category', 'isActive'],
  properties: {
    id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, slug: { type: 'string' },
    category: { type: 'string' }, isActive: { type: 'boolean' },
  },
} as const;

const baseProperties = {
  id: { type: 'string', format: 'uuid' }, customerId: { type: 'string', format: 'uuid' },
  serviceId: { type: 'string', format: 'uuid' }, description: { type: 'string' },
  status: { type: 'string', enum: statuses }, preferredDate: nullableDate,
  address: nullableString, city: nullableString, completedAt: nullableDate, cancelledAt: nullableDate,
  createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
} as const;

const publicResponse = {
  type: 'object', additionalProperties: false,
  required: ['id', 'customerId', 'serviceId', 'description', 'status', 'preferredDate', 'address', 'city', 'completedAt', 'cancelledAt', 'createdAt', 'updatedAt'],
  properties: baseProperties,
} as const;

const adminResponse = {
  type: 'object', additionalProperties: false,
  required: [...publicResponse.required, 'internalNotes', 'customer', 'service'],
  properties: { ...baseProperties, internalNotes: nullableString, customer: customerSummary, service: serviceSummary },
} as const;

export const createServiceRequestSchema = {
  body: {
    type: 'object', additionalProperties: false,
    required: ['customer', 'serviceId', 'description', 'address', 'city'],
    properties: {
      customer: {
        type: 'object', additionalProperties: false, required: ['name', 'phone'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 500 },
          phone: { type: 'string', minLength: 1, maxLength: 30 },
          email: { anyOf: [{ type: 'string', maxLength: 320 }, { type: 'null' }] },
        },
      },
      serviceId: { type: 'string', format: 'uuid' },
      description: { type: 'string', minLength: SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH, maxLength: SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH },
      preferredDate: nullableDate,
      address: { type: 'string', minLength: 1, maxLength: SERVICE_REQUEST_ADDRESS_MAX_LENGTH },
      city: { type: 'string', minLength: 1, maxLength: SERVICE_REQUEST_CITY_MAX_LENGTH },
    },
  },
  response: { 201: publicResponse },
} as const;

export const listServiceRequestsSchema = {
  querystring: {
    type: 'object', additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: SERVICE_REQUEST_MAX_LIMIT, default: SERVICE_REQUEST_DEFAULT_LIMIT },
      search: { type: 'string', minLength: 1, maxLength: 200 }, status: { type: 'string', enum: statuses },
      customerId: { type: 'string', format: 'uuid' }, serviceId: { type: 'string', format: 'uuid' },
      createdFrom: { type: 'string', format: 'date-time' }, createdTo: { type: 'string', format: 'date-time' },
      preferredDateFrom: { type: 'string', format: 'date-time' }, preferredDateTo: { type: 'string', format: 'date-time' },
      sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'preferredDate', 'status'], default: 'createdAt' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
  },
  response: {
    200: {
      type: 'object', additionalProperties: false, required: ['data', 'pagination'],
      properties: {
        data: { type: 'array', items: adminResponse },
        pagination: {
          type: 'object', additionalProperties: false, required: ['page', 'limit', 'total', 'totalPages'],
          properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
        },
      },
    },
  },
} as const;

export const getServiceRequestSchema = { params: idParams, response: { 200: adminResponse } } as const;

export const updateServiceRequestSchema = {
  params: idParams,
  body: {
    type: 'object', additionalProperties: false, minProperties: 1,
    properties: {
      description: { type: 'string', minLength: SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH, maxLength: SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH },
      preferredDate: nullableDate,
      address: { type: 'string', minLength: 1, maxLength: SERVICE_REQUEST_ADDRESS_MAX_LENGTH },
      city: { type: 'string', minLength: 1, maxLength: SERVICE_REQUEST_CITY_MAX_LENGTH },
      internalNotes: { anyOf: [{ type: 'string', maxLength: SERVICE_REQUEST_INTERNAL_NOTES_MAX_LENGTH }, { type: 'null' }] },
    },
  },
  response: { 200: adminResponse },
} as const;

export const updateServiceRequestStatusSchema = {
  params: idParams,
  body: {
    type: 'object', additionalProperties: false, required: ['status'],
    properties: { status: { type: 'string', enum: statuses } },
  },
  response: { 200: adminResponse },
} as const;
