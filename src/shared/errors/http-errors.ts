import { AppError } from './app-error.js';
import type { ErrorDetail } from './error-response.js';

interface HttpErrorOptions {
  code?: string | undefined;
  message?: string | undefined;
  details?: ErrorDetail[] | undefined;
}

export class BadRequestError extends AppError {
  constructor({
    code = 'BAD_REQUEST',
    message = 'Bad request',
    details,
  }: HttpErrorOptions = {}) {
    super({ code, message, statusCode: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor({
    code = 'UNAUTHORIZED',
    message = 'Unauthorized',
    details,
  }: HttpErrorOptions = {}) {
    super({ code, message, statusCode: 401, details });
  }
}

export class ForbiddenError extends AppError {
  constructor({
    code = 'FORBIDDEN',
    message = 'Forbidden',
    details,
  }: HttpErrorOptions = {}) {
    super({ code, message, statusCode: 403, details });
  }
}

export class NotFoundError extends AppError {
  constructor({
    code = 'RESOURCE_NOT_FOUND',
    message = 'Resource not found',
    details,
  }: HttpErrorOptions = {}) {
    super({ code, message, statusCode: 404, details });
  }
}

export class ConflictError extends AppError {
  constructor({
    code = 'CONFLICT',
    message = 'Resource conflict',
    details,
  }: HttpErrorOptions = {}) {
    super({ code, message, statusCode: 409, details });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor({
    code = 'UNPROCESSABLE_ENTITY',
    message = 'Unprocessable entity',
    details,
  }: HttpErrorOptions = {}) {
    super({ code, message, statusCode: 422, details });
  }
}
