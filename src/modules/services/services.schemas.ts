import {
  SERVICE_DEFAULT_LIMIT,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_MAX_LIMIT,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_NAME_MIN_LENGTH,
} from './services.types.js';

const serviceProperties = {
  id: { type: 'string', format: 'uuid' },
  name: {
    type: 'string',
    minLength: SERVICE_NAME_MIN_LENGTH,
    maxLength: SERVICE_NAME_MAX_LENGTH,
  },
  slug: {
    type: 'string',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  },
  description: {
    type: 'string',
    minLength: 1,
    maxLength: SERVICE_DESCRIPTION_MAX_LENGTH,
  },
  category: { type: 'string', minLength: 1, maxLength: 100 },
  isActive: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
} as const;

const serviceResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'name',
    'slug',
    'description',
    'category',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  properties: serviceProperties,
} as const;

const createBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'slug', 'description', 'category'],
  properties: {
    name: serviceProperties.name,
    slug: serviceProperties.slug,
    description: serviceProperties.description,
    category: serviceProperties.category,
  },
} as const;

export const listServicesSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: SERVICE_MAX_LIMIT,
        default: SERVICE_DEFAULT_LIMIT,
      },
      search: { type: 'string', minLength: 1, maxLength: 120 },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      isActive: { type: 'boolean' },
      orderBy: {
        type: 'string',
        enum: ['name', 'createdAt'],
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
        data: { type: 'array', items: serviceResponseSchema },
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

export const getServiceSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['slug'],
    properties: { slug: { type: 'string', minLength: 1 } },
  },
  response: { 200: serviceResponseSchema },
} as const;

export const createServiceSchema = {
  body: createBodySchema,
  response: { 201: serviceResponseSchema },
} as const;

export const updateServiceSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      ...createBodySchema.properties,
      isActive: serviceProperties.isActive,
    },
  },
  response: { 200: serviceResponseSchema },
} as const;

export const deactivateServiceSchema = {
  params: updateServiceSchema.params,
  response: { 200: serviceResponseSchema },
} as const;
