const publicUserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'email', 'role'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['ADMIN', 'OPERATOR'] },
  },
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
      properties: {
        accessToken: { type: 'string' },
        tokenType: { type: 'string', const: 'Bearer' },
        expiresIn: { type: 'integer' },
        user: publicUserSchema,
      },
    },
  },
} as const;

export const meSchema = {
  response: {
    200: publicUserSchema,
  },
} as const;
