import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CauseEffectRule, StreamStatus } from '../types/telemetry';

export const RULES_RETRY_MS = 3000;

/**
 * Loads the Cause & Effect matrix, and loads it again whenever the backend
 * reports a new matrix revision (after an upload or a restore).
 *
 * A failed load is retried on a timer while the stream stays connected. Without
 * that, one transient error would leave the matrix empty, or stale after an
 * upload, until the stream happened to reconnect.
 */
export function useRules(streamStatus: StreamStatus, revision: number | null): CauseEffectRule[] {
  const [rules, setRules] = useState<CauseEffectRule[]>([]);
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
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
      })
      .catch(() => {
        if (cancelled) return;
        retryTimer = window.setTimeout(() => setAttempt((count) => count + 1), RULES_RETRY_MS);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [upToDate, revision, streamStatus, attempt]);

  return rules;
}
