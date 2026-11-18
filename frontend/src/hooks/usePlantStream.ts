import { useEffect, useState } from 'react';
import { useDemoStream } from '../demo/useDemoStream';
import { API_BASE } from '../lib/api';
import { DEMO_MODE } from '../lib/demoMode';
import type { PlantSnapshot, StreamStatus } from '../types/telemetry';

export const RETRY_MS = 3000;
// The backend sends an update or a heartbeat event at least every 5 s. If
// nothing arrives for this long the connection is considered dead and rebuilt.
// This catches the case where a proxy keeps the browser side open after the
// backend has gone away, which EventSource alone does not report.
export const STALE_MS = 8000;
const FAILURES_BEFORE_DISCONNECTED = 3;

/**
 * Subscribes to the SSE stream. Each event carries a full plant snapshot, so a
 * client that reconnects is consistent again after a single message.
 *
 * EventSource reconnects by itself after network errors, but it gives up when
 * the server answers with an HTTP error (for example a 502 while the backend
 * restarts). That case is retried manually here.
 */
function useLiveStream(): { snapshot: PlantSnapshot | null; status: StreamStatus } {
  const [snapshot, setSnapshot] = useState<PlantSnapshot | null>(null);
  const [status, setStatus] = useState<StreamStatus>('RECONNECTING');

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let staleTimer: number | undefined;
    let disposed = false;
    let failures = 0;

    const recordFailure = () => {
      failures += 1;
      setStatus(failures >= FAILURES_BEFORE_DISCONNECTED ? 'DISCONNECTED' : 'RECONNECTING');
    };

    const armStaleTimer = () => {
      window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(() => {
        recordFailure();
        scheduleRetry();
      }, STALE_MS);
    };

    const scheduleRetry = () => {
      source?.close();
      // A rebuild is already on its way: the silence timer must not fire again
      // and count the same outage twice.
      window.clearTimeout(staleTimer);
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(connect, RETRY_MS);
    };

    const onSnapshot = (event: MessageEvent<string>) => {
      failures = 0;
      setStatus('CONNECTED');
      setSnapshot(JSON.parse(event.data) as PlantSnapshot);
      armStaleTimer();
    };

    function connect() {
      if (disposed) return;
      source = new EventSource(`${API_BASE}/stream`);
      // Armed from the start: a connection that is accepted but never sends a
      // byte fires neither `open` nor `error`, and must still be given up on.
      armStaleTimer();
      source.addEventListener('snapshot', onSnapshot as EventListener);
      source.addEventListener('update', onSnapshot as EventListener);
      source.addEventListener('heartbeat', armStaleTimer);
      source.onopen = () => {
        failures = 0;
        setStatus('CONNECTED');
        armStaleTimer();
      };
      source.onerror = () => {
        recordFailure();
        if (source?.readyState === EventSource.CLOSED) {
          scheduleRetry();
        } else {
          // The browser is reconnecting by itself: give that attempt a full window.
          armStaleTimer();
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(staleTimer);
      source?.close();
    };
  }, []);

  return { snapshot, status };
}

/** The live SSE stream, or the in-page simulation in the browser demo build. */
export const usePlantStream = DEMO_MODE ? useDemoStream : useLiveStream;
