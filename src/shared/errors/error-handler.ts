import { Prisma } from '@prisma/client';
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';

import { AppError } from './app-error.js';
import type { ErrorDetail, ErrorResponse } from './error-response.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from './http-errors.js';

const INTERNAL_SERVER_ERROR_MESSAGE = 'An unexpected error occurred';

function fastifyValidationError(error: FastifyError): AppError | undefined {
  if (error.validation === undefined) {
    return undefined;
  }

  const details: ErrorDetail[] = error.validation.map((issue) => ({
    code: issue.keyword,
    field: issue.instancePath || issue.params.missingProperty?.toString(),
    message: issue.message ?? 'Invalid value',
  }));

  return new BadRequestError({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details,
  });
}

function zodValidationError(error: unknown): AppError | undefined {
  if (!(error instanceof ZodError)) {
    return undefined;
  }

  return new BadRequestError({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

function prismaError(error: unknown): AppError | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }

  if (error.code === 'P2002') {
    return new ConflictError({
      code: 'RESOURCE_CONFLICT',
      message: 'A resource with the provided data already exists',
    });
  }

  if (error.code === 'P2025') {
    return new NotFoundError();
  }

  return undefined;
}

function normalizeError(error: FastifyError): AppError | undefined {
  return (
    fastifyValidationError(error) ??
    zodValidationError(error) ??
    prismaError(error) ??
    (error instanceof AppError ? error : undefined)
  );
}

function createResponse(error: AppError, requestId: string): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      requestId,
    },
  };
}

function handleError(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const operationalError = normalizeError(error);

  if (operationalError !== undefined && operationalError.isOperational) {
    request.log.warn(
      {
        err: error,
        errorCode: operationalError.code,
        statusCode: operationalError.statusCode,
      },
      'Operational request error',
    );
    void reply
      .status(operationalError.statusCode)
      .send(createResponse(operationalError, request.id));
    return;
  }

  request.log.error({ err: error }, 'Unexpected request error');

  const internalError = new AppError({
    code: 'INTERNAL_SERVER_ERROR',
    message: INTERNAL_SERVER_ERROR_MESSAGE,
    statusCode: 500,
    isOperational: false,
  });

  void reply.status(500).send(createResponse(internalError, request.id));
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler(handleError);
  app.setNotFoundHandler((request, reply) => {
    handleError(new NotFoundError(), request, reply);
  });
}
