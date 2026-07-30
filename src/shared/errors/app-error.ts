import type { ErrorDetail } from './error-response.js';

interface AppErrorOptions {
  code: string;
  message: string;
  statusCode: number;
  details?: ErrorDetail[] | undefined;
  isOperational?: boolean;
}

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: ErrorDetail[];
  readonly isOperational: boolean;

  constructor({
    code,
    message,
    statusCode,
    details = [],
    isOperational = true,
  }: AppErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, new.target);
  }
}
