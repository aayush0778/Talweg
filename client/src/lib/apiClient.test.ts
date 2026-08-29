import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost, simulateRisk, ApiClientError, fetchRegions } from './apiClient';

describe('API Client (apiClient.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on 200 OK for apiGet', async () => {
    const mockData = [{ id: 'sikkim', name: 'Sikkim' }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    } as unknown as Response);

    const result = await fetchRegions();
    expect(result).toEqual(mockData);
  });

  it('unwraps error envelope on 400/404/500 API responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          message: "Risk zone 'unknown' not found",
          code: 'ZONE_NOT_FOUND',
        },
      }),
    } as unknown as Response);

    try {
      await apiGet('/api/risk-zones/unknown');
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.name).toBe('ApiClientError');
      expect(err.message).toBe("Risk zone 'unknown' not found");
      expect(err.code).toBe('ZONE_NOT_FOUND');
      expect(err.status).toBe(404);
    }
  });

  it('handles network disconnection gracefully with NETWORK_ERROR code and status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await apiGet('/api/health');
      expect.fail('Should have thrown ApiClientError');
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.name).toBe('ApiClientError');
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.status).toBe(0);
      expect(err.message).toContain('Cannot reach the SlopeGuard API');
    }
  });

  it('handles non-JSON error response from proxy or gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: new Headers({ 'content-type': 'text/html' }),
      json: async () => {
        throw new Error('Not JSON');
      },
    } as unknown as Response);

    try {
      await apiGet('/api/health');
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.status).toBe(502);
      expect(err.code).toBe('HTTP_502');
      expect(err.message).toContain('502');
    }
  });

  it('sends POST request with JSON headers and stringified body', async () => {
    const mockResponse = {
      zone_id: 'gangtok',
      risk_score: 0.606,
      risk_level: 'HIGH',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    } as unknown as Response);

    const payload = { zone_id: 'gangtok', rainfall_24h: 150 };
    const result = await apiPost<{ zone_id: string; risk_score: number; risk_level: string }>(
      '/api/risk/simulate',
      payload
    );

    expect(fetchSpy).toHaveBeenCalledWith('/api/risk/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(mockResponse);
  });

  it('unwraps 400 VALIDATION_ERROR on invalid simulate payload in apiPost', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          message: 'Invalid risk calculation payload',
          code: 'VALIDATION_ERROR',
        },
      }),
    } as unknown as Response);

    try {
      await simulateRisk({ zone_id: 'gangtok', rainfall_24h: -10 });
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.name).toBe('ApiClientError');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.status).toBe(400);
    }
  });

  it('handles network failure on apiPost', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await simulateRisk({ zone_id: 'gangtok', rainfall_24h: 150 });
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.status).toBe(0);
    }
  });
});
