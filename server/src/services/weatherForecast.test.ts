import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getZoneWeatherForecast,
  clearForecastCache,
  ZONE_LOCATIONS,
} from './weatherForecast';

describe('Weather Forecast Service (weatherForecast.ts)', () => {
  beforeEach(() => {
    clearForecastCache();
  });

  it('fetches a 5-day precipitation forecast for Gangtok with valid shape', async () => {
    const forecast = await getZoneWeatherForecast('gangtok');
    assert.ok(forecast, 'Forecast response must exist');
    assert.equal(forecast.zone_id, 'gangtok');
    assert.equal(forecast.zone_name, 'Gangtok Corridor');
    assert.ok(forecast.provenance, 'Provenance metadata must be present');
    assert.ok(['REAL', 'SYNTHETIC'].includes(forecast.provenance.type));

    // Verify 5 forecast days
    assert.equal(forecast.forecast_days.length, 5);

    forecast.forecast_days.forEach((day, idx) => {
      assert.ok(day.date, `Day ${idx} must have an ISO date string`);
      assert.ok(day.day, `Day ${idx} must have a day abbreviation`);
      assert.ok(typeof day.rainfall_mm === 'number' && day.rainfall_mm >= 0, `Day ${idx} rainfall must be non-negative number`);
      assert.ok(day.icon, `Day ${idx} must have a weather icon`);
      assert.ok(['light', 'moderate', 'heavy', 'very_heavy'].includes(day.intensity));
      assert.ok(typeof day.warning === 'boolean');
    });
  });

  it('serves cached forecast on subsequent requests for the same zone', async () => {
    const first = await getZoneWeatherForecast('mangan');
    const second = await getZoneWeatherForecast('mangan');

    assert.equal(first.fetched_at, second.fetched_at, 'Cached response should share fetched_at timestamp');
    assert.deepEqual(first.forecast_days, second.forecast_days);
  });

  it('generates valid forecasts across all 6 Sikkim districts', async () => {
    const zoneIds = Object.keys(ZONE_LOCATIONS);
    assert.equal(zoneIds.length, 6, 'Must have 6 defined Sikkim zones');

    for (const zoneId of zoneIds) {
      const fc = await getZoneWeatherForecast(zoneId);
      assert.equal(fc.zone_id, zoneId);
      assert.equal(fc.forecast_days.length, 5);
      assert.ok(fc.forecast_days[0].rainfall_mm >= 0);
    }
  });

  it('gracefully handles unknown zone id by falling back to default location', async () => {
    const fc = await getZoneWeatherForecast('unknown-zone-xyz');
    assert.ok(fc);
    assert.equal(fc.forecast_days.length, 5);
  });
});
