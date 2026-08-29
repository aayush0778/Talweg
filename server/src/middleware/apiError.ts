/**
 * Application Error class carrying status code, machine-readable error code,
 * and optional details for validation or debugging.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code = 'VALIDATION_ERROR', details?: unknown): ApiError {
    return new ApiError(400, message, code, details);
  }

  static notFound(message: string, code = 'NOT_FOUND'): ApiError {
    return new ApiError(404, message, code);
  }

  static database(message = 'Database service temporarily unavailable', details?: unknown): ApiError {
    return new ApiError(503, message, 'DATABASE_ERROR', details);
  }

  static internal(message = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(500, message, 'INTERNAL_ERROR', details);
  }
}
