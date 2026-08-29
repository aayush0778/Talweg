import {
  Region,
  RiskZone,
  LandslideEvent,
  EnvironmentObservation,
  HealthResponse,
  ApiErrorResponse,
} from '../types/api';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err) {
    throw new ApiClientError(
      'Cannot reach the SlopeGuard API — is the server running?',
      'NETWORK_ERROR',
      0,
      err
    );
  }

  let body: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse | null;
    const message =
      errorBody?.error?.message || `Request failed with status ${response.status} (${response.statusText})`;
    const code = errorBody?.error?.code || `HTTP_${response.status}`;
    const details = errorBody?.error?.details;

    throw new ApiClientError(message, code, response.status, details);
  }

  return body as T;
}

export function fetchRegions(): Promise<Region[]> {
  return apiGet<Region[]>('/api/regions');
}

export function fetchRiskZones(regionId?: string): Promise<RiskZone[]> {
  const query = regionId ? `?region_id=${encodeURIComponent(regionId)}` : '';
  return apiGet<RiskZone[]>(`/api/risk-zones${query}`);
}

export function fetchRiskZone(id: string): Promise<RiskZone> {
  return apiGet<RiskZone>(`/api/risk-zones/${encodeURIComponent(id)}`);
}

export function fetchEvents(params?: {
  region_id?: string;
  zone_id?: string;
  limit?: number;
}): Promise<LandslideEvent[]> {
  const searchParams = new URLSearchParams();
  if (params?.region_id) searchParams.set('region_id', params.region_id);
  if (params?.zone_id) searchParams.set('zone_id', params.zone_id);
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiGet<LandslideEvent[]>(`/api/events${qs ? `?${qs}` : ''}`);
}

export function fetchEnvironment(zoneId: string): Promise<EnvironmentObservation> {
  return apiGet<EnvironmentObservation>(`/api/environment/${encodeURIComponent(zoneId)}`);
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/api/health');
}
