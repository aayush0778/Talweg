import {
  Region,
  RiskZone,
  LandslideEvent,
  EnvironmentObservation,
  HealthResponse,
  RiskPredictionResponse,
  PredictRiskRequest,
  SimulateRiskRequest,
  AlertResponse,
  CopilotAskRequest,
  CopilotResponse,
  ApiErrorResponse,
  ModelValidationResponse,
  HistoricalReplayListItem,
  HistoricalReplayResponse,
  ValidationSummaryResponse,
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

async function handleResponse<T>(response: Response): Promise<T> {
  let body: unknown = null;
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

// In development, use the Vite proxy (relative path works)
// In production on Render/Railway, VITE_API_URL is injected
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  const url = `${API_BASE_URL}${path}`;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(import.meta.env.VITE_API_KEY ? { 'X-API-Key': import.meta.env.VITE_API_KEY } : {}),
      },
    });
  } catch (err) {
    throw new ApiClientError(
      'Cannot reach the Talweg API — is the server running?',
      'NETWORK_ERROR',
      0,
      err
    );
  }

  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  const url = `${API_BASE_URL}${path}`;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(import.meta.env.VITE_API_KEY ? { 'X-API-Key': import.meta.env.VITE_API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiClientError(
      'Cannot reach the Talweg API — is the server running?',
      'NETWORK_ERROR',
      0,
      err
    );
  }

  return handleResponse<T>(response);
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

export function fetchModelValidation(): Promise<ModelValidationResponse> {
  return apiGet<ModelValidationResponse>('/api/model-validation');
}

export function fetchAlerts(params?: {
  status?: string;
  zone_id?: string;
}): Promise<AlertResponse[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.zone_id) searchParams.set('zone_id', params.zone_id);

  const qs = searchParams.toString();
  return apiGet<AlertResponse[]>(`/api/alerts${qs ? `?${qs}` : ''}`);
}

export function predictRisk(req: PredictRiskRequest): Promise<RiskPredictionResponse> {
  return apiPost<RiskPredictionResponse>('/api/risk/predict', req);
}

export function simulateRisk(req: SimulateRiskRequest): Promise<RiskPredictionResponse> {
  return apiPost<RiskPredictionResponse>('/api/risk/simulate', req);
}

export function askCopilot(req: CopilotAskRequest): Promise<CopilotResponse> {
  return apiPost<CopilotResponse>('/api/copilot/ask', req);
}

export function fetchHistoricalReplays(): Promise<HistoricalReplayListItem[]> {
  return apiGet<HistoricalReplayListItem[]>('/api/historical-replays');
}

export function fetchHistoricalReplayById(id: string): Promise<HistoricalReplayListItem> {
  return apiGet<HistoricalReplayListItem>(`/api/historical-replays/${encodeURIComponent(id)}`);
}

export function replayHistoricalEvent(id: string): Promise<HistoricalReplayResponse> {
  return apiGet<HistoricalReplayResponse>(`/api/historical-replays/${encodeURIComponent(id)}/replay`);
}

export function fetchValidationSummary(): Promise<ValidationSummaryResponse> {
  return apiGet<ValidationSummaryResponse>('/api/model-validation/summary');
}
