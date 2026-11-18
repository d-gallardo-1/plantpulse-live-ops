import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CauseEffectRule, StreamStatus } from '../types/telemetry';

export const RULES_RETRY_MS = 3000;
export const RULES_RETRY_MAX_MS = 30000;

/** Wait before retry number `attempt` (0-based): 3 s, 6 s, 12 s, 24 s, then 30 s. */
export function retryDelay(attempt: number): number {
  return Math.min(RULES_RETRY_MS * 2 ** attempt, RULES_RETRY_MAX_MS);
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
 * delay so a broken endpoint is not polled at a fixed rate by every client,
 * and the failure is reported so the UI can say why the matrix is missing.
 */
export function useRules(streamStatus: StreamStatus, revision: number | null): RulesState {
  const [rules, setRules] = useState<CauseEffectRule[]>([]);
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const upToDate = revision !== null && loadedRevision === revision;

  useEffect(() => {
    if (upToDate || revision === null || streamStatus !== 'CONNECTED') return;
    let cancelled = false;
    let retryTimer: number | undefined;
    api
      .matrix()
      .then((response) => {
        if (cancelled) return;
        setRules(response.rules);
        setLoadedRevision(revision);
        setLoadError(null);
        setAttempt(0);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause.message : 'unknown error');
        retryTimer = window.setTimeout(() => setAttempt((count) => count + 1), retryDelay(attempt));
      });
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [upToDate, revision, streamStatus, attempt]);

  return { rules, loadError };
}
