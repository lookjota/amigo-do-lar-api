import 'dotenv/config';

import { z } from 'zod';

const corsOriginsSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(
    z
      .array(
        z.string().refine(
          (origin) => {
            const parsedOrigin = URL.parse(origin);

            return (
              parsedOrigin !== null &&
              ['http:', 'https:'].includes(parsedOrigin.protocol) &&
              parsedOrigin.origin === origin
            );
          },
          {
            message:
              'CORS origins must be HTTP(S) origins without paths, queries, or fragments',
          },
        ),
      )
      .min(1, 'CORS_ORIGINS must contain at least one origin'),
  );

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
    ATTACHMENT_STORAGE_DRIVER: z
      .enum(['s3', 'fake', 'disabled'])
      .default('disabled'),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),
    ATTACHMENT_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().max(100 * 1024 * 1024).default(10 * 1024 * 1024),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'test' && value.DATABASE_URL === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required outside the test environment',
        path: ['DATABASE_URL'],
      });
    }
    if (value.NODE_ENV !== 'test' && value.ATTACHMENT_STORAGE_DRIVER === 'fake') {
      context.addIssue({ code: 'custom', message: 'Fake attachment storage is allowed only in tests', path: ['ATTACHMENT_STORAGE_DRIVER'] });
    }
    if (value.ATTACHMENT_STORAGE_DRIVER === 's3') {
      for (const key of ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (value[key] === undefined) context.addIssue({ code: 'custom', message: `${key} is required for S3 attachment storage`, path: [key] });
      }
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment variables: ${z.prettifyError(result.error)}`,
  );
}

export const env = result.data;
