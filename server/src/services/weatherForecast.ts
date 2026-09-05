import { ZoneForecastResponse, WeatherForecastDay } from '../types/api';

interface ZoneGeoLocation {
  zone_id: string;
  zone_name: string;
  latitude: number;
  longitude: number;
  default_daily_rain: number;
}

export const ZONE_LOCATIONS: Record<string, ZoneGeoLocation> = {
  mangan: {
    zone_id: 'mangan',
    zone_name: 'Mangan - Teesta Valley',
    latitude: 27.516,
    longitude: 88.528,
    default_daily_rain: 45.0,
  },
  gangtok: {
    zone_id: 'gangtok',
    zone_name: 'Gangtok Corridor',
    latitude: 27.330,
    longitude: 88.610,
    default_daily_rain: 35.0,
  },
  namchi: {
    zone_id: 'namchi',
    zone_name: 'Namchi Zone',
    latitude: 27.180,
    longitude: 88.360,
    default_daily_rain: 20.0,
  },
  pakyong: {
    zone_id: 'pakyong',
    zone_name: 'Pakyong Area',
    latitude: 27.230,
    longitude: 88.620,
    default_daily_rain: 28.0,
  },
  gyalshing: {
    zone_id: 'gyalshing',
    zone_name: 'Gyalshing - West Sikkim',
    latitude: 27.320,
    longitude: 88.260,
    default_daily_rain: 24.0,
  },
  soreng: {
    zone_id: 'soreng',
    zone_name: 'Soreng Sub-division',
    latitude: 27.160,
    longitude: 88.180,
    default_daily_rain: 30.0,
  },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function classifyIntensity(mm: number): WeatherForecastDay['intensity'] {
  if (mm < 2.5) return 'light';
  if (mm < 15.0) return 'moderate';
  if (mm < 50.0) return 'heavy';
  return 'very_heavy';
}

function getWeatherIcon(code: number, rainMm: number): string {
  if (code >= 95) return '⛈️'; // Thunderstorm
  if (code >= 80 || rainMm >= 30) return '🌧️'; // Heavy rain / showers
  if (code >= 51 || rainMm >= 5) return '🌦️'; // Rain / drizzle
  if (code === 45 || code === 48) return '🌫️'; // Fog
  if (code >= 1 && code <= 3) return '⛅'; // Partly cloudy
  return '☀️'; // Clear
}

interface CacheEntry {
  data: ZoneForecastResponse;
  expiresAt: number;
}

// In-memory 3-hour cache per zone
const forecastCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Generate a deterministic synthetic forecast if upstream is unreachable.
 */
function generateFallbackForecast(loc: ZoneGeoLocation, baseRain?: number): WeatherForecastDay[] {
  const rain = baseRain ?? loc.default_daily_rain;
  const today = new Date();
  const days: WeatherForecastDay[] = [];

  // Deterministic 5-day oscillation multipliers
  const factors = [0.85, 1.25, 0.95, 1.40, 0.70];

  for (let i = 0; i < 5; i++) {
    const fDate = new Date(today);
    fDate.setDate(today.getDate() + i + 1);

    const dayRain = Math.round(rain * factors[i] * 10) / 10;
    const intensity = classifyIntensity(dayRain);
    const warning = dayRain >= 50.0;

    days.push({
      date: fDate.toISOString().slice(0, 10),
      day: DAY_NAMES[fDate.getDay()],
      rainfall_mm: dayRain,
      probability_pct: Math.min(95, Math.round(50 + factors[i] * 30)),
      icon: getWeatherIcon(dayRain >= 40 ? 95 : dayRain >= 15 ? 80 : 61, dayRain),
      intensity,
      warning,
    });
  }

  return days;
}

/**
 * Fetch 5-day weather forecast for a risk zone.
 * Attempts to query live NCMRWF/IMD assimilated forecast via Open-Meteo with a 3s timeout.
 * Automatically falls back to deterministic model on network error or offline conditions.
 */
export async function getZoneWeatherForecast(
  zoneId: string,
  baseRainfall?: number
): Promise<ZoneForecastResponse> {
  const normZone = zoneId.toLowerCase();
  const loc = ZONE_LOCATIONS[normZone] || ZONE_LOCATIONS.gangtok;

  // 1. Check in-memory cache
  const cached = forecastCache.get(loc.zone_id);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 2. Attempt live upstream fetch with 3-second timeout
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=precipitation_sum,precipitation_probability_max,weather_code&forecast_days=5&timezone=Asia%2FKolkata`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent': 'TALWEG-Landslide-DSS/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Upstream weather service returned HTTP ${res.status}`);
    }

    const payload = (await res.json()) as {
      daily?: {
        time?: string[];
        precipitation_sum?: (number | null)[];
        precipitation_probability_max?: (number | null)[];
        weather_code?: (number | null)[];
      };
    };

    if (payload?.daily?.time && payload.daily.precipitation_sum) {
      const times = payload.daily.time;
      const sums = payload.daily.precipitation_sum;
      const probs = payload.daily.precipitation_probability_max || [];
      const codes = payload.daily.weather_code || [];

      const forecast_days: WeatherForecastDay[] = times.slice(0, 5).map((isoDate, idx) => {
        const d = new Date(isoDate);
        const mm = Math.max(0, Math.round((sums[idx] ?? 0) * 10) / 10);
        const prob = probs[idx] != null ? Math.round(Number(probs[idx])) : undefined;
        const code = codes[idx] != null ? Number(codes[idx]) : 0;
        const intensity = classifyIntensity(mm);
        const warning = mm >= 50.0 || (mm >= 35.0 && (prob ?? 0) >= 70);

        return {
          date: isoDate,
          day: DAY_NAMES[d.getDay()],
          rainfall_mm: mm,
          probability_pct: prob,
          icon: getWeatherIcon(code, mm),
          intensity,
          warning,
        };
      });

      const responseData: ZoneForecastResponse = {
        zone_id: loc.zone_id,
        zone_name: loc.zone_name,
        forecast_days,
        provenance: {
          type: 'REAL',
          source: 'IMD / NCMRWF (via Open-Meteo High-Resolution Assimilation)',
          sourceUrl: 'https://open-meteo.com',
          note: 'Live 5-day NWP precipitation forecast for Sikkim',
        },
        fetched_at: new Date().toISOString(),
      };

      // Store in cache
      forecastCache.set(loc.zone_id, {
        data: responseData,
        expiresAt: now + CACHE_TTL_MS,
      });

      return responseData;
    }
  } catch {
    // Upstream error or timeout — gracefully fall through to deterministic model
  }

  // 3. Resilient Fallback: Deterministic forecast with SYNTHETIC provenance
  const fallbackDays = generateFallbackForecast(loc, baseRainfall);

  return {
    zone_id: loc.zone_id,
    zone_name: loc.zone_name,
    forecast_days: fallbackDays,
    provenance: {
      type: 'SYNTHETIC',
      source: 'TALWEG Deterministic Fallback',
      note: 'Offline mode — live meteorological forecast unavailable',
    },
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Clear the in-memory cache (for testing).
 */
export function clearForecastCache(): void {
  forecastCache.clear();
}
