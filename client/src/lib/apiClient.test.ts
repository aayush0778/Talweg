import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, ApiClientError, fetchRegions } from './apiClient';

describe('API Client (apiClient.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on 200 OK', async () => {
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

    await expect(apiGet('/api/risk-zones/unknown')).rejects.toThrow(ApiClientError);

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
});
