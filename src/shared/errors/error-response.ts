export interface ErrorDetail {
  code?: string | undefined;
  field?: string | undefined;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details: ErrorDetail[];
    requestId?: string | undefined;
  };
}
