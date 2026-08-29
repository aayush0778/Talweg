import { Request, Response, NextFunction } from 'express';

/**
 * Standard error response shape used across all endpoints.
 * Consistent error format makes the frontend simpler — it always
 * knows what shape to expect on failure.
 */
export interface ErrorResponseBody {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Express error-handling middleware.
 * Must have 4 parameters for Express to recognize it as an error handler.
 */
export function errorHandler(
  err: Error & { statusCode?: number; status?: number; code?: string; details?: unknown },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Support err.statusCode (ApiError) or err.status (body-parser malformed JSON 400)
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');

  const body: ErrorResponseBody = {
    error: {
      message: err.message || 'Internal server error',
      code: errorCode,
    },
  };

  // Include stack trace and details only in development
  if (process.env.NODE_ENV === 'development') {
    body.error.details = err.details || err.stack;
  }

  console.error(`[error] ${statusCode} ${err.message}`);
  res.status(statusCode).json(body);
}
