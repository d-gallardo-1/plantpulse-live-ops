import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { CauseEffectRule, StreamStatus } from '../types/telemetry';

export const RULES_RETRY_MS = 3000;
export const RULES_RETRY_MAX_MS = 30000;

/** Share of the delay that is randomised, in each direction. */
export const RULES_RETRY_JITTER = 0.2;

/**
 * Wait before retry number `attempt` (0-based): about 3 s, 6 s, 12 s, 24 s, then
 * 30 s. Each wait is varied by up to 20 % either way, so clients that failed
 * together (for example when the backend restarts) do not retry in step.
 * `random` is a number in [0, 1); 0.5 gives the nominal delay.
 */
export function retryDelay(attempt: number, random: number = Math.random()): number {
  const nominal = Math.min(RULES_RETRY_MS * 2 ** attempt, RULES_RETRY_MAX_MS);
  return Math.round(nominal * (1 - RULES_RETRY_JITTER + 2 * RULES_RETRY_JITTER * random));
}

export interface RulesState {
  rules: CauseEffectRule[];
  /** Why the latest load failed, or null. The previous rules stay available meanwhile. */
  loadError: string | null;
}

/**
 * Loads the Cause & Effect matrix, and loads it again whenever the backend
 * reports a new matrix revision (after an upload or a restore).
 *
 * A failed load is retried while the stream stays connected, with a growing
 * and slightly randomised delay so a broken endpoint is not polled at a fixed
 * rate, or at the same instant, by every client,
 * and the failure is reported so the UI can say why the matrix is missing.
 */
export function useRules(streamStatus: StreamStatus, revision: number | null): RulesState {
  const [rules, setRules] = useState<CauseEffectRule[]>([]);
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Consecutive failures for one revision. Kept in a ref, not in state: starting
  // over for a new revision must not trigger a second, redundant request.
  const failures = useRef<{ revision: number | null; count: number }>({ revision: null, count: 0 });
  const upToDate = revision !== null && loadedRevision === revision;

  useEffect(() => {
    if (streamStatus !== 'CONNECTED') {
      failures.current.count = 0; // a new connection starts with the short delay again
      return;
    }
    if (upToDate || revision === null) return;
    if (failures.current.revision !== revision) failures.current = { revision, count: 0 };

    let cancelled = false;
    let retryTimer: number | undefined;
    api
      .matrix()
      .then((response) => {
        if (cancelled) return;
        failures.current.count = 0;
        setRules(response.rules);
        setLoadedRevision(revision);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause.message : 'unknown error');
        const delay = retryDelay(failures.current.count);
        failures.current.count += 1;
        retryTimer = window.setTimeout(() => setRetryTick((tick) => tick + 1), delay);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [upToDate, revision, streamStatus, retryTick]);

  return { rules, loadError };
}
