import { QueryResult, QueryResultRow } from 'pg';
import { pool } from './index';
import { ApiError } from '../middleware/apiError';

const DB_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  '57014', // query_canceled / statement_timeout
  '28P01', // invalid_password
  '3D000', // invalid_catalog_name
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
]);

export function isDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const error = err as { code?: string; errno?: number | string; syscall?: string };
  if (error.code && DB_ERROR_CODES.has(String(error.code))) return true;
  if (error.syscall === 'connect') return true;
  return false;
}

export function mapDbError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isDbError(err)) {
    return ApiError.database('Database service temporarily unavailable', err);
  }
  if (err instanceof Error) {
    return ApiError.internal(err.message, err);
  }
  return ApiError.internal('Unknown database error', err);
}

/**
 * Parameterized query helper using the shared PostgreSQL pool.
 * Automatically catches database connection/timeout failures and maps them to 503 ApiError.database.
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  try {
    return await pool.query<R>(text, params);
  } catch (err) {
    throw mapDbError(err);
  }
}
