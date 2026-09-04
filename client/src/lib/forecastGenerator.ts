import type { RiskLevel } from '../types/api';

/**
 * Generates a 5-day synthetic rainfall forecast for demonstration.
 * In production, this would integrate with IMD or OpenWeatherMap APIs.
 *
 * The forecast is deterministic given the same baseline rainfall,
 * creating a monsoon-progression pattern for realistic demo storytelling.
 */

export interface ForecastDay {
  day: string;         // e.g., 'Mon', 'Tue'
  date: string;        // e.g., 'Sep 5'
  rainfall_mm: number; // expected rainfall
  intensity: 'none' | 'light' | 'moderate' | 'heavy' | 'extreme';
  icon: string;        // emoji icon
  warning: boolean;    // true if exceeds HIGH-risk threshold
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Rainfall threshold that triggers HIGH risk (approximate, from risk engine normalization)
const HIGH_RAINFALL_THRESHOLD = 120; // mm/24h

function classifyIntensity(mm: number): ForecastDay['intensity'] {
  if (mm < 5) return 'none';
  if (mm < 30) return 'light';
  if (mm < 80) return 'moderate';
  if (mm < 150) return 'heavy';
  return 'extreme';
}

function getIcon(intensity: ForecastDay['intensity']): string {
  switch (intensity) {
    case 'none': return '☀️';
    case 'light': return '🌦️';
    case 'moderate': return '🌧️';
    case 'heavy': return '⛈️';
    case 'extreme': return '🌊';
  }
}

/**
 * Generates 5 forecast days starting from tomorrow.
 * Pattern: escalating monsoon with a slight dip on day 3 for realism.
 */
export function generateForecast(
  baselineRainfall24h: number | null,
  _riskLevel: RiskLevel | null,
): ForecastDay[] {
  const base = baselineRainfall24h ?? 50;
  const today = new Date();

  // Monsoon progression multipliers (escalating with a mid-week dip)
  const multipliers = [1.1, 1.3, 0.9, 1.5, 1.7];

  return multipliers.map((mult, i) => {
    const forecastDate = new Date(today);
    forecastDate.setDate(today.getDate() + i + 1);

    // Add some pseudo-random variation based on day index and base
    const variation = ((base * 7 + i * 13) % 20) - 10;
    const rainfall = Math.max(0, Math.round(base * mult + variation));
    const intensity = classifyIntensity(rainfall);

    return {
      day: DAY_NAMES[forecastDate.getDay()],
      date: `${MONTH_NAMES[forecastDate.getMonth()]} ${forecastDate.getDate()}`,
      rainfall_mm: rainfall,
      intensity,
      icon: getIcon(intensity),
      warning: rainfall >= HIGH_RAINFALL_THRESHOLD,
    };
  });
}
