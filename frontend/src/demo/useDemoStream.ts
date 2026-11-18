import { useEffect, useState } from 'react';
import type { PlantSnapshot, StreamStatus } from '../types/telemetry';
import { demoEngine } from './demoApi';

/**
 * Stand-in for the SSE subscription in the browser demo: the snapshots come
 * from the engine running in the page, so the "stream" is always connected.
 */
export function useDemoStream(): { snapshot: PlantSnapshot | null; status: StreamStatus } {
  const [snapshot, setSnapshot] = useState<PlantSnapshot | null>(() => demoEngine().snapshot());

  useEffect(() => demoEngine().subscribe(setSnapshot), []);

  return { snapshot, status: 'CONNECTED' };
}
