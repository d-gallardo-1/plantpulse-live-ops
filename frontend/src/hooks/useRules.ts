import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CauseEffectRule, StreamStatus } from '../types/telemetry';

/**
 * Loads the Cause & Effect matrix, and loads it again whenever the backend
 * reports a new matrix revision (after an upload or a restore). If the backend
 * was not reachable, the load is retried on the next stream connection.
 */
export function useRules(streamStatus: StreamStatus, revision: number | null): CauseEffectRule[] {
  const [rules, setRules] = useState<CauseEffectRule[]>([]);
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null);
  const upToDate = revision !== null && loadedRevision === revision;

  useEffect(() => {
    if (upToDate || revision === null || streamStatus !== 'CONNECTED') return;
    let cancelled = false;
    api
      .matrix()
      .then((response) => {
        if (cancelled) return;
        setRules(response.rules);
        setLoadedRevision(revision);
      })
      .catch(() => {
        /* retried on the next successful stream connection */
      });
    return () => {
      cancelled = true;
    };
  }, [upToDate, revision, streamStatus]);

  return rules;
}
