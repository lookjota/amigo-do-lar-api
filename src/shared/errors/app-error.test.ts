import { describe, expect, it } from 'vitest';

import { AppError } from './app-error.js';
import { NotFoundError } from './http-errors.js';

describe('AppError', () => {
  it('preserves its properties', () => {
    const details = [{ field: 'email', message: 'Email is invalid' }];
    const error = new AppError({
      code: 'INVALID_EMAIL',
      message: 'Invalid email',
      statusCode: 400,
      details,
      isOperational: false,
    });

    expect(error).toMatchObject({
      name: 'AppError',
      code: 'INVALID_EMAIL',
      message: 'Invalid email',
      statusCode: 400,
      details,
      isOperational: false,
    });
  });

  it('creates a not found error with status 404', () => {
    const error = new NotFoundError();

    expect(error).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
      details: [],
      isOperational: true,
    });
  });
});
