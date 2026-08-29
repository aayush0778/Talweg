export const FACTOR_META: Record<
  string,
  { label: string; format: (raw: number) => string }
> = {
  rainfall_24h: {
    label: '24h Rainfall',
    format: (v: number) => `${v} mm`,
  },
  rainfall_3d: {
    label: '3-Day Rainfall',
    format: (v: number) => `${v} mm`,
  },
  slope: {
    label: 'Slope',
    format: (v: number) => `${v}°`,
  },
  soil_moisture: {
    label: 'Soil Saturation',
    format: (v: number) => `${Math.round(v * 100)}%`,
  },
  historical_density: {
    label: 'Historical Incidents',
    format: (v: number) => `${v} events`,
  },
};

/**
 * Calculates the percentage share of the total risk score contributed by a factor.
 * Returns null if totalScore is 0 or negative.
 */
export function contributionShare(
  contribution: number,
  totalScore: number
): number | null {
  if (totalScore <= 0) return null;
  return Math.round((contribution / totalScore) * 100);
}
