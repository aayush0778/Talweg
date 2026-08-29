import { useState, useEffect, useCallback, useRef } from 'react';
import { RiskZone, EnvironmentObservation, RiskPredictionResponse } from '../types/api';
import {
  ScenarioValues,
  isAtBaseline,
  envBelongsToZone,
  buildSimulateRequest,
} from '../lib/scenario';
import { simulateRisk } from '../lib/apiClient';

export interface UseScenarioResult {
  values: ScenarioValues | null;
  setValues: React.Dispatch<React.SetStateAction<ScenarioValues | null>>;
  simulation: RiskPredictionResponse | null;
  simLoading: boolean;
  simError: Error | null;
  reset: () => void;
  isModified: boolean;
  available: boolean;
}

export function useScenario(
  zone: RiskZone | null,
  env: EnvironmentObservation | null
): UseScenarioResult {
  const [values, setValues] = useState<ScenarioValues | null>(null);
  const [simulation, setSimulation] = useState<RiskPredictionResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<Error | null>(null);
  const seqRef = useRef(0);

  // (Re)initialize when the selected zone or its environment changes;
  // always clears any active scenario.
  useEffect(() => {
    // CHANGED: during an async zone switch, env can still hold the PREVIOUS
    // zone's observation. Skip — the new zone's env will re-trigger this effect.
    if (zone && env && env.zone_id !== zone.id) return;

    // CHANGED: any in-flight simulate request is now obsolete. Bump the
    // sequence so its response is discarded even if it lands after this reset.
    seqRef.current++;

    const complete =
      env !== null &&
      env.rainfall_24h !== null &&
      env.rainfall_3d !== null &&
      env.soil_moisture !== null;

    setValues(
      complete && env
        ? {
            rainfall_24h: env.rainfall_24h!,
            rainfall_3d: env.rainfall_3d!,
            soil_moisture: env.soil_moisture!,
          }
        : null
    );
    setSimulation(null);
    setSimError(null);
    setSimLoading(false);
    // CHANGED: zone?.id added — re-initializes on same-zone deselect/reselect
  }, [zone?.id, env?.zone_id, env?.timestamp]);

  // Debounced simulate — runs on every values change
  useEffect(() => {
    if (!zone || !values || !env) return;

    // CHANGED: never simulate against a stale env from a different zone
    // (brief window during async zone switching)
    if (!envBelongsToZone(zone.id, env)) return;

    if (isAtBaseline(values, env)) {
      // CHANGED: invalidate any in-flight request so a late response cannot
      // resurrect a scenario after we've returned to baseline
      seqRef.current++;
      setSimulation(null); // back to observed — no API call needed
      setSimError(null);
      setSimLoading(false);
      return;
    }

    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      setSimLoading(true);
      setSimError(null);
      try {
        const result = await simulateRisk(buildSimulateRequest(zone.id, values));
        if (seqRef.current === seq) {
          setSimulation(result);
        }
      } catch (err) {
        if (seqRef.current === seq) {
          setSimError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (seqRef.current === seq) {
          setSimLoading(false);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [values, zone?.id, env]);

  const reset = useCallback(() => {
    if (!env) return;
    setValues({
      rainfall_24h: env.rainfall_24h ?? 0,
      rainfall_3d: env.rainfall_3d ?? 0,
      soil_moisture: env.soil_moisture ?? 0,
    });
    // effect sees baseline → clears simulation automatically
  }, [env]);

  const isModified = values !== null && env !== null && !isAtBaseline(values, env);

  return {
    values,
    setValues,
    simulation,
    simLoading,
    simError,
    reset,
    isModified,
    available: values !== null,
  };
}
