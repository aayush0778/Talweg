import { useState, useEffect, useCallback } from 'react';
import { AlertResponse } from '../types/api';
import { fetchAlerts } from '../lib/apiClient';

export interface UseAlertsResult {
  alerts: AlertResponse[];
  refresh: () => void;
}

export function useAlerts(pollIntervalMs = 20000): UseAlertsResult {
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadAlerts() {
      try {
        const data = await fetchAlerts({ status: 'active' });
        if (!isCancelled) {
          setAlerts(data);
        }
      } catch {
        if (!isCancelled) {
          // Never crash app for alert banner failure; hide silently
          setAlerts([]);
        }
      }
    }

    loadAlerts();
    const timer = setInterval(loadAlerts, pollIntervalMs);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [pollIntervalMs, reloadKey]);

  return { alerts, refresh };
}
