import 'dotenv/config';

import { z } from 'zod';

const corsOriginsSchema = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url()));

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().max(65_535).default(3_000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: corsOriginsSchema,
    DATABASE_URL: z.url().optional(),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.coerce.number().int().positive(),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(12),
    ADMIN_NAME: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'test' && value.DATABASE_URL === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required outside the test environment',
        path: ['DATABASE_URL'],
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment variables: ${z.prettifyError(result.error)}`,
  );
}

export const env = result.data;
