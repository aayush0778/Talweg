import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClientError } from '../lib/apiClient';

export interface ApiResourceState<T> {
  data: T | null;
  error: ApiClientError | Error | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Generic hook for fetching API resources with:
 * - Automatic cancellation on unmount / dependency changes to avoid race conditions
 * - Manual reload capability
 * - Loading and error states
 * - Optional `enabled` flag to delay fetch until prerequisites (e.g. selectedZoneId) are met
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  enabled = true
): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [reloadCount, setReloadCount] = useState<number>(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    setReloadCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (!isCancelled) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount, enabled]);

  return { data, error, loading, reload };
}
