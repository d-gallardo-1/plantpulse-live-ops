import { useEffect, useRef, useState } from 'react';
import type { PlantSnapshot } from '../types/telemetry';

const HISTORY_LENGTH = 40;

export type LatencyHistory = Record<string, (number | null)[]>;

/**
 * Keeps the last latency samples of every network node. It lives at the
 * application level so the trend keeps building while another view is open.
 */
export function useLatencyHistory(snapshot: PlantSnapshot | null): LatencyHistory {
  const [history, setHistory] = useState<LatencyHistory>({});
  const lastSequence = useRef<number | null>(null);

  useEffect(() => {
    // One sample per snapshot, even if the effect runs twice for the same one.
    if (!snapshot || snapshot.sequence === lastSequence.current) return;
    lastSequence.current = snapshot.sequence;
    setHistory((previous) => {
      const next: LatencyHistory = {};
      for (const node of snapshot.network_nodes) {
        const samples = [...(previous[node.node_id] ?? []), node.latency_ms];
        next[node.node_id] = samples.slice(-HISTORY_LENGTH);
      }
      return next;
    });
  }, [snapshot]);

  return history;
}
