import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDbError, mapDbError } from './query';
import { ApiError } from '../middleware/apiError';

describe('query and DB Error Mapping (Unit Tests)', () => {
  it('identifies connection and database error codes correctly', () => {
    assert.equal(isDbError({ code: 'ECONNREFUSED' }), true);
    assert.equal(isDbError({ code: 'ETIMEDOUT' }), true);
    assert.equal(isDbError({ code: '57014' }), true);
    assert.equal(isDbError({ syscall: 'connect' }), true);
    assert.equal(isDbError({ code: 'UNKNOWN_CUSTOM_CODE' }), false);
    assert.equal(isDbError(null), false);
  });

  it('maps connection errors to 503 DATABASE_ERROR ApiError', () => {
    const err = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' };
    const mapped = mapDbError(err);
    assert.ok(mapped instanceof ApiError);
    assert.equal(mapped.statusCode, 503);
    assert.equal(mapped.code, 'DATABASE_ERROR');
    assert.equal(mapped.message, 'Database service temporarily unavailable');
  });

  it('preserves existing ApiError instances without modification', () => {
    const original = ApiError.notFound('Zone not found', 'ZONE_NOT_FOUND');
    const mapped = mapDbError(original);
    assert.equal(mapped, original);
  });

  it('maps unexpected errors to 500 INTERNAL_ERROR ApiError', () => {
    const generic = new Error('Something went wrong in query parser');
    const mapped = mapDbError(generic);
    assert.equal(mapped.statusCode, 500);
    assert.equal(mapped.code, 'INTERNAL_ERROR');
    assert.equal(mapped.message, 'Something went wrong in query parser');
  });
});
