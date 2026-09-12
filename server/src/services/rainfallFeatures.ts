/**
 * Rainfall Temporal Feature Pipeline (Final Upgrade Spec §7)
 *
 * Computes rolling-window rainfall features from TIMESTAMPED daily
 * observations — never fabricated from a single current value.
 *
 * Features produced (all DERIVED from the observation series, which itself
 * carries REAL or SYNTHETIC provenance):
 *  - rainfall_24h / rainfall_3d / rainfall_5d / rainfall_7d  (rolling sums, mm)
 *  - rainfall_intensity (mean over available window, mm/day)
 *  - antecedent_rainfall_index (exponentially weighted memory, τ = 3 days)
 *  - rainfall_anomaly — ONLY when a climatological baseline is supplied
 *    (spec §7.4: never compute anomaly without an adequate baseline)
 */

export interface RainfallObservation {
  /** ISO timestamp or YYYY-MM-DD for the observation day */
  date: string;
  /** observed precipitation in mm (0 is a valid observed zero) */
  precip_mm: number;
}

export interface RainfallWindowFeatures {
  rainfall_24h: number | null;
  rainfall_3d: number | null;
  rainfall_5d: number | null;
  rainfall_7d: number | null;
  rainfall_intensity: number | null;
  /** mean daily intensity over the 7d window (mm/day) */
  max_daily_intensity: number | null;
  antecedent_rainfall_index: number | null;
  /** only computed when a climatological baseline is provided */
  rainfall_anomaly: number | null;
  /** number of daily observations available in the 7-day window */
  observation_count_7d: number;
  window_start: string | null;
  window_end: string | null;
}

/** ARI decay time constant in days (spec §7.3: τ = 3 days unless calibrated otherwise). */
export const ARI_TAU_DAYS = 3;

export const FEATURE_TRANSFORMATION = {
  rainfall_24h: 'rolling_sum_1d',
  rainfall_3d: 'rolling_sum_3d',
  rainfall_5d: 'rolling_sum_5d',
  rainfall_7d: 'rolling_sum_7d',
  antecedent_rainfall_index: 'exp_weighted_memory_tau3d',
  rainfall_intensity: 'mean_intensity_available_window',
};

function toDayKey(dateLike: string): string {
  // normalize any ISO timestamp to YYYY-MM-DD
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return dateLike.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / 86_400_000
  );
}

/**
 * Antecedent Rainfall Index (spec §7.3):
 *   ARI_t = P_t + exp(-Δt/τ) × ARI_(t-1),  τ = 3 days
 * Iterated over the ordered daily series. Returns the ARI at the final day.
 * This is a rainfall-memory index — NOT a probability.
 */
export function calculateAriFromSeries(series: RainfallObservation[]): number | null {
  if (series.length === 0) return null;
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  let ari = 0;
  let prevDate: string | null = null;
  for (const obs of sorted) {
    const day = toDayKey(obs.date);
    if (prevDate === null) {
      ari = Math.max(0, obs.precip_mm);
    } else {
      const gap = Math.min(Math.max(dayDiff(day, prevDate), 1), 30);
      ari = Math.max(0, obs.precip_mm) + Math.exp(-gap / ARI_TAU_DAYS) * ari;
    }
    prevDate = day;
  }
  return Math.round(ari * 100) / 100;
}

/**
 * ARI reconstructed from window aggregates when no daily series exists.
 * Same decay law, distributing window remainders uniformly. Used only as a
 * documented approximation when daily data is unavailable (spec: time
 * resolution must be stated — callers surface `transformation` accordingly).
 */
export function calculateAriFromAggregates(
  rainfall_24h: number,
  rainfall_3d: number,
  rainfall_7d?: number | null
): number {
  const r0 = Math.max(0, rainfall_24h);
  const r12 = Math.max(0, rainfall_3d - rainfall_24h) / 2.0;
  const r36 = Math.max(0, Math.max(rainfall_7d ?? rainfall_3d, rainfall_3d) - rainfall_3d) / 4.0;
  let sum = r0;
  sum += r12 * (Math.exp(-1 / ARI_TAU_DAYS) + Math.exp(-2 / ARI_TAU_DAYS));
  for (let k = 3; k < 7; k++) sum += r36 * Math.exp(-k / ARI_TAU_DAYS);
  return Math.round(sum * 100) / 100;
}

export interface AnomalyBaseline {
  /** climatological mean daily rainfall for the window (mm/day) */
  mean: number;
  /** climatological standard deviation (mm/day) */
  std: number;
}

export interface BuildRainfallFeaturesOptions {
  /** reference day (defaults to last observation day) */
  asOf?: string;
  /** optional climatology enabling anomaly computation (spec §7.4) */
  anomalyBaseline?: AnomalyBaseline;
}

/**
 * Build the canonical rainfall window features from an ordered daily series.
 * Windows anchored at `asOf` (or the last observation). Missing windows are
 * `null` when there is no coverage — never zero-filled.
 */
export function buildRainfallFeatures(
  series: RainfallObservation[],
  opts: BuildRainfallFeaturesOptions = {}
): RainfallWindowFeatures {
  if (series.length === 0) {
    return {
      rainfall_24h: null,
      rainfall_3d: null,
      rainfall_5d: null,
      rainfall_7d: null,
      rainfall_intensity: null,
      max_daily_intensity: null,
      antecedent_rainfall_index: null,
      rainfall_anomaly: null,
      observation_count_7d: 0,
      window_start: null,
      window_end: null,
    };
  }

  const byDay = new Map<string, number>();
  for (const obs of series) {
    const day = toDayKey(obs.date);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.max(0, obs.precip_mm));
  }

  const asOf = toDayKey(opts.asOf ?? series.reduce((latest, o) => (o.date > latest ? o.date : latest), series[0].date));

  const sumWindow = (days: number): { sum: number | null; count: number } => {
    let sum = 0;
    let count = 0;
    for (let k = 0; k < days; k++) {
      const d = new Date(asOf + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - k);
      const key = d.toISOString().slice(0, 10);
      const v = byDay.get(key);
      if (v !== undefined) {
        sum += v;
        count += 1;
      }
    }
    return { sum: count > 0 ? Math.round(sum * 100) / 100 : null, count };
  };

  const w1 = sumWindow(1);
  const w3 = sumWindow(3);
  const w5 = sumWindow(5);
  const w7 = sumWindow(7);

  const windowStart = new Date(asOf + 'T00:00:00Z');
  windowStart.setUTCDate(windowStart.getUTCDate() - 6);
  const windowStartIso = windowStart.toISOString().slice(0, 10);

  // Mean intensity over the available (covered) window portion — spec §7.2.
  const total = w7.sum ?? 0;
  const coveredDays = Math.max(w7.count, 1);
  const rainfallIntensity = w7.sum !== null ? Math.round((total / coveredDays) * 100) / 100 : null;

  let maxDaily = 0;
  for (let k = 0; k < 7; k++) {
    const d = new Date(asOf + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - k);
    const v = byDay.get(d.toISOString().slice(0, 10));
    if (v !== undefined && v > maxDaily) maxDaily = v;
  }

  const ordered = series
    .filter((o) => {
      const day = toDayKey(o.date);
      return dayDiff(asOf, day) >= 0 && dayDiff(asOf, day) < 7;
    })
    .map((o) => ({ date: toDayKey(o.date), precip_mm: o.precip_mm }));
  const ari = calculateAriFromSeries(ordered);

  let anomaly: number | null = null;
  if (opts.anomalyBaseline && w7.sum !== null && w7.count > 0) {
    // anomaly = observed window mean − climatological mean (spec §7.4)
    anomaly =
      Math.round((total / coveredDays - opts.anomalyBaseline.mean) * 100) / 100;
  }

  return {
    rainfall_24h: w1.sum,
    rainfall_3d: w3.sum,
    rainfall_5d: w5.sum,
    rainfall_7d: w7.sum,
    rainfall_intensity: rainfallIntensity,
    max_daily_intensity: maxDaily > 0 ? Math.round(maxDaily * 100) / 100 : 0,
    antecedent_rainfall_index: ari,
    rainfall_anomaly: anomaly,
    observation_count_7d: w7.count,
    window_start: windowStartIso,
    window_end: asOf,
  };
}
