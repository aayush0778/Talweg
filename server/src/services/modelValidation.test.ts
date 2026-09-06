import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runModelValidationBacktest } from '../services/modelValidation';
import { BACKTEST_EVENTS } from '../services/backtestScenarios';

// ============================================================
// Unit Tests for the Model Validation Backtest
// ============================================================
// Pure computation — no database, no server, no network. Uses the same
// node:test runner as riskEngine.test.ts.
// ============================================================

describe('runModelValidationBacktest()', () => {
  it('scores exactly the 17 seeded historical events', () => {
    const summary = runModelValidationBacktest();
    assert.equal(summary.total_events, 17);
    assert.equal(summary.results.length, 17);
    assert.equal(BACKTEST_EVENTS.length, 17);
  });

  it('every result carries a valid risk level and a matching flagged boolean', () => {
    const summary = runModelValidationBacktest();
    const validLevels = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];

    for (const r of summary.results) {
      assert.ok(validLevels.includes(r.predicted_risk_level));
      const shouldBeFlagged = r.predicted_risk_level === 'HIGH' || r.predicted_risk_level === 'SEVERE';
      assert.equal(r.flagged, shouldBeFlagged);
    }
  });

  it('by_level counts sum to total_events and match flagged_high_or_severe', () => {
    const summary = runModelValidationBacktest();
    const sumByLevel =
      summary.by_level.LOW + summary.by_level.MODERATE + summary.by_level.HIGH + summary.by_level.SEVERE;
    assert.equal(sumByLevel, summary.total_events);
    assert.equal(summary.by_level.HIGH + summary.by_level.SEVERE, summary.flagged_high_or_severe);
  });

  it('flagged_pct is a consistent percentage of flagged_high_or_severe / total_events', () => {
    const summary = runModelValidationBacktest();
    const expectedPct = Math.round((summary.flagged_high_or_severe / summary.total_events) * 1000) / 10;
    assert.equal(summary.flagged_pct, expectedPct);
  });

  it('is fully deterministic across repeated runs (same inputs, same outputs)', () => {
    const first = runModelValidationBacktest();
    const second = runModelValidationBacktest();
    assert.deepEqual(first.results, second.results);
    assert.equal(first.flagged_high_or_severe, second.flagged_high_or_severe);
  });

  it('always returns methodology and caveat text so the client cannot drop the disclosure', () => {
    const summary = runModelValidationBacktest();
    assert.ok(summary.methodology.length > 0);
    assert.ok(summary.caveat.length > 0);
    assert.match(summary.caveat.toLowerCase(), /synthetic/);
  });

  it('events with fatalities are scored no lower than an otherwise-identical zero-fatality event of the same category', () => {
    const summary = runModelValidationBacktest();
    // evt-002 (gangtok, landslide, 0 fatalities) vs evt-001 (gangtok, landslide, 2 fatalities)
    const zeroFatal = summary.results.find((r) => r.id === 'evt-002')!;
    const fatal = summary.results.find((r) => r.id === 'evt-001')!;
    assert.ok(fatal.predicted_risk_score >= zeroFatal.predicted_risk_score);
  });
});
