import { useState, useEffect } from 'react';
import { HealthResponse } from '../types/api';
import { fetchHealth } from '../lib/apiClient';

export interface HealthState {
  health: HealthResponse | null;
  error: Error | null;
  loading: boolean;
}

export function useHealth(pollIntervalMs = 20000): HealthState {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    async function checkHealth() {
      try {
        const data = await fetchHealth();
        if (!isCancelled) {
          setHealth(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          // If server responded with 503,ApiClientError carries status and details
          setError(err instanceof Error ? err : new Error(String(err)));
          setHealth((prev) =>
            prev
              ? { ...prev, status: 'degraded', database: 'disconnected' }
              : { status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString() }
          );
          setLoading(false);
        }
      }
    }

    checkHealth();
    const timer = setInterval(checkHealth, pollIntervalMs);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return { health, error, loading };
}
