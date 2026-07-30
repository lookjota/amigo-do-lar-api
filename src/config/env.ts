import 'dotenv/config';

import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url().optional(),
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
