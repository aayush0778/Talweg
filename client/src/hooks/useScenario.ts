import { useState, useEffect, useCallback, useRef } from 'react';
import { RiskZone, EnvironmentObservation, RiskPredictionResponse } from '../types/api';
import { ScenarioValues, isAtBaseline, buildSimulateRequest } from '../lib/scenario';
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

  // (Re)initialize when zone/env changes; always clear scenario
  useEffect(() => {
    seqRef.current++; // Invalidate any pending in-flight response

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
  }, [zone?.id, env?.zone_id, env?.timestamp]); // re-inits when zone selection changes or env arrives

  // Debounced simulate — runs on every values change
  useEffect(() => {
    if (!zone || !values || !env) return;

    if (isAtBaseline(values, env)) {
      seqRef.current++; // Invalidate pending response so it cannot overwrite baseline
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
