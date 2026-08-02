import {
  CUSTOMER_DEFAULT_LIMIT,
  CUSTOMER_MAX_LIMIT,
  CUSTOMER_NAME_MAX_LENGTH,
} from './customers.types.js';

const customerProperties = {
  id: { type: 'string', format: 'uuid' },
  name: { type: 'string', minLength: 1, maxLength: CUSTOMER_NAME_MAX_LENGTH },
  phone: { type: 'string', minLength: 1, maxLength: 30 },
  email: { anyOf: [{ type: 'string', format: 'email' }, { type: 'null' }] },
  isActive: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
} as const;

const customerResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'name',
    'phone',
    'email',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  properties: customerProperties,
} as const;

const idParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: customerProperties.id },
} as const;

const mutableProperties = {
  name: { type: 'string', minLength: 1, maxLength: 500 },
  phone: customerProperties.phone,
  email: {
    anyOf: [{ type: 'string', maxLength: 320 }, { type: 'null' }],
  },
  isActive: customerProperties.isActive,
} as const;

export const listCustomersSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: CUSTOMER_MAX_LIMIT,
        default: CUSTOMER_DEFAULT_LIMIT,
      },
      search: { type: 'string', minLength: 1, maxLength: 120 },
      isActive: { type: 'boolean' },
      sortBy: {
        type: 'string',
        enum: ['name', 'createdAt', 'updatedAt'],
        default: 'name',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'asc',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['data', 'pagination'],
      properties: {
        data: { type: 'array', items: customerResponseSchema },
        pagination: {
          type: 'object',
          additionalProperties: false,
          required: ['page', 'limit', 'total', 'totalPages'],
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  },
} as const;

export const getCustomerSchema = {
  params: idParamsSchema,
  response: { 200: customerResponseSchema },
} as const;

export const createCustomerSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'phone'],
    properties: {
      name: mutableProperties.name,
      phone: mutableProperties.phone,
      email: mutableProperties.email,
    },
  },
  response: { 201: customerResponseSchema },
} as const;

export const updateCustomerSchema = {
  params: idParamsSchema,
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: mutableProperties,
  },
  response: { 200: customerResponseSchema },
} as const;

export const deactivateCustomerSchema = {
  params: idParamsSchema,
  response: { 200: customerResponseSchema },
} as const;
