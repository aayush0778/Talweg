import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  idSchema,
  riskBodySchema,
  eventsQuerySchema,
  zonesQuerySchema,
  zoneIdParamSchema,
} from './schemas';

describe('Validation Schemas (Unit Tests)', () => {
  describe('idSchema', () => {
    it('accepts valid alphanumeric IDs with dashes and underscores', () => {
      assert.ok(idSchema.safeParse('gangtok').success);
      assert.ok(idSchema.safeParse('zone_123').success);
      assert.ok(idSchema.safeParse('nh-10-corridor').success);
    });

    it('rejects empty string', () => {
      assert.equal(idSchema.safeParse('').success, false);
    });

    it('rejects string exceeding 50 characters', () => {
      const longId = 'a'.repeat(51);
      assert.equal(idSchema.safeParse(longId).success, false);
    });

    it('rejects strings with invalid characters or SQL injection attempts', () => {
      assert.equal(idSchema.safeParse('zone; DROP TABLE regions;').success, false);
      assert.equal(idSchema.safeParse('zone/id').success, false);
      assert.equal(idSchema.safeParse('zone id').success, false);
      assert.equal(idSchema.safeParse('zone@123').success, false);
    });
  });

  describe('riskBodySchema', () => {
    it('accepts minimal valid body with only zone_id', () => {
      const result = riskBodySchema.safeParse({ zone_id: 'gangtok' });
      assert.ok(result.success);
      if (result.success) {
        assert.equal(result.data.zone_id, 'gangtok');
      }
    });

    it('accepts full valid body with numeric parameters', () => {
      const result = riskBodySchema.safeParse({
        zone_id: 'gangtok',
        rainfall_24h: 85.5,
        rainfall_3d: 180,
        soil_moisture: 0.78,
        slope: 35,
        historical_density: 5,
      });
      assert.ok(result.success);
    });

    it('accepts boundary values for rainfall, moisture, and slope', () => {
      assert.ok(
        riskBodySchema.safeParse({
          zone_id: 'z1',
          rainfall_24h: 0,
          rainfall_3d: 0,
          soil_moisture: 0,
          slope: 0,
          historical_density: 0,
        }).success
      );

      assert.ok(
        riskBodySchema.safeParse({
          zone_id: 'z1',
          rainfall_24h: 300, // Above normal 200 max, but within allowed upper bound (engine clamps)
          soil_moisture: 1.0,
          slope: 60,
        }).success
      );
    });

    it('rejects negative rainfall values', () => {
      const result = riskBodySchema.safeParse({ zone_id: 'gangtok', rainfall_24h: -10 });
      assert.equal(result.success, false);
    });

    it('rejects soil_moisture > 1.0', () => {
      const result = riskBodySchema.safeParse({ zone_id: 'gangtok', soil_moisture: 1.5 });
      assert.equal(result.success, false);
    });

    it('rejects slope > 90', () => {
      const result = riskBodySchema.safeParse({ zone_id: 'gangtok', slope: 95 });
      assert.equal(result.success, false);
    });

    it('rejects non-integer historical_density', () => {
      const result = riskBodySchema.safeParse({ zone_id: 'gangtok', historical_density: 3.5 });
      assert.equal(result.success, false);
    });

    it('rejects string numbers in body (strict typing)', () => {
      const result = riskBodySchema.safeParse({ zone_id: 'gangtok', rainfall_24h: '85' });
      assert.equal(result.success, false);
    });

    it('rejects unknown/unexpected properties (.strict)', () => {
      const result = riskBodySchema.safeParse({
        zone_id: 'gangtok',
        rainfall24h: 85, // typo in key
      });
      assert.equal(result.success, false);
    });
  });

  describe('eventsQuerySchema', () => {
    it('applies default limit of 200 when omitted', () => {
      const result = eventsQuerySchema.safeParse({});
      assert.ok(result.success);
      if (result.success) {
        assert.equal(result.data.limit, 200);
      }
    });

    it('coerces string limit from query parameters', () => {
      const result = eventsQuerySchema.safeParse({ limit: '50' });
      assert.ok(result.success);
      if (result.success) {
        assert.equal(result.data.limit, 50);
      }
    });

    it('rejects limit < 1 or > 500', () => {
      assert.equal(eventsQuerySchema.safeParse({ limit: '0' }).success, false);
      assert.equal(eventsQuerySchema.safeParse({ limit: '501' }).success, false);
    });

    it('rejects non-numeric limit string', () => {
      assert.equal(eventsQuerySchema.safeParse({ limit: 'abc' }).success, false);
    });

    it('rejects unknown query keys', () => {
      assert.equal(eventsQuerySchema.safeParse({ foo: 'bar' }).success, false);
    });
  });

  describe('zonesQuerySchema and zoneIdParamSchema', () => {
    it('validates optional region_id', () => {
      assert.ok(zonesQuerySchema.safeParse({ region_id: 'sikkim' }).success);
      assert.ok(zonesQuerySchema.safeParse({}).success);
    });

    it('validates zoneId parameter', () => {
      assert.ok(zoneIdParamSchema.safeParse({ zoneId: 'gangtok' }).success);
      assert.equal(zoneIdParamSchema.safeParse({ zoneId: '' }).success, false);
    });
  });
});
