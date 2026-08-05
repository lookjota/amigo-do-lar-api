import { USER_DEFAULT_LIMIT, USER_MAX_LIMIT, USER_NAME_MAX_LENGTH, USER_PASSWORD_MIN_LENGTH } from './users.types.js';

const role = { type: 'string', enum: ['ADMIN', 'OPERATOR'] } as const;
const publicUser = {
  type: 'object', additionalProperties: false,
  required: ['id', 'name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' }, name: { type: 'string' },
    email: { type: 'string', format: 'email' }, role, isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;
const params = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const name = { type: 'string', minLength: 1, maxLength: USER_NAME_MAX_LENGTH + 20 } as const;
const email = { type: 'string', minLength: 1, maxLength: 340 } as const;
const password = { type: 'string', minLength: USER_PASSWORD_MIN_LENGTH, maxLength: 1024 } as const;

export const listUsersSchema = {
  querystring: { type: 'object', additionalProperties: false, properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: USER_MAX_LIMIT, default: USER_DEFAULT_LIMIT },
    search: { type: 'string', minLength: 1, maxLength: 120 }, role, isActive: { type: 'boolean' },
    orderBy: { type: 'string', enum: ['name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'], default: 'name' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
  } },
  response: { 200: { type: 'object', additionalProperties: false, required: ['data', 'pagination'], properties: {
    data: { type: 'array', items: publicUser }, pagination: { type: 'object', additionalProperties: false,
      required: ['page', 'limit', 'total', 'totalPages'], properties: {
        page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' },
      } },
  } } },
} as const;
export const getUserSchema = { params, response: { 200: publicUser } } as const;
export const createUserSchema = {
  body: { type: 'object', additionalProperties: false, required: ['name', 'email', 'password', 'role'], properties: {
    name, email, password, role, isActive: { type: 'boolean' },
  } }, response: { 201: publicUser },
} as const;
export const updateUserSchema = {
  params, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name, email, role } },
  response: { 200: publicUser },
} as const;
export const updateUserStatusSchema = {
  params, body: { type: 'object', additionalProperties: false, required: ['isActive'], properties: { isActive: { type: 'boolean' } } },
  response: { 200: publicUser },
} as const;
export const resetUserPasswordSchema = {
  params, body: { type: 'object', additionalProperties: false, required: ['password'], properties: { password } },
  response: { 204: { type: 'null' } },
} as const;
