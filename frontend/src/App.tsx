import { useMemo, useState } from 'react';
import { LiveAlarmDiagnostics } from './components/LiveAlarmDiagnostics';
import { MatrixExplorer } from './components/MatrixExplorer';
import { NetworkWatchdog } from './components/NetworkWatchdog';
import { ProcessTopologyMap } from './components/ProcessTopologyMap';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { useLatencyHistory } from './hooks/useLatencyHistory';
import { usePlantStream } from './hooks/usePlantStream';
import { useRules } from './hooks/useRules';
import type { ViewId } from './types/telemetry';

/** Application shell (orchestrator): one SSE subscription feeds every view. */
export default function App() {
  const { snapshot, status } = usePlantStream();
  const rules = useRules(status, snapshot?.matrix_revision ?? null);
  const latencyHistory = useLatencyHistory(snapshot);
  const [view, setView] = useState<ViewId>('live');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const activeCodes = useMemo(
    () => new Set((snapshot?.active_alarms ?? []).map((alarm) => alarm.rule.alarm_code)),
    [snapshot?.active_alarms],
  );

  return (
    <div className="min-h-screen">
      <TopTelemetryBar snapshot={snapshot} streamStatus={status} view={view} onViewChange={setView} />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {!snapshot ? (
          <p className="panel p-4 text-sm text-slate-300" role="status">
            {status === 'DISCONNECTED'
              ? 'Cannot reach the backend. Retrying every few seconds; check that the API is running on port 8000.'
              : 'Waiting for the first plant snapshot…'}
          </p>
        ) : view === 'live' ? (
          <>
            <ProcessTopologyMap
              stations={snapshot.stations}
              selectedStationId={selectedStationId}
              onSelect={setSelectedStationId}
            />
            <LiveAlarmDiagnostics
              snapshot={snapshot}
              rules={rules}
              selectedStationId={selectedStationId}
              onClearFilter={() => setSelectedStationId(null)}
            />
          </>
        ) : view === 'matrix' ? (
          <MatrixExplorer
            rules={rules}
            stations={snapshot.stations}
            activeCodes={activeCodes}
            matrixSource={snapshot.matrix_source}
          />
        ) : (
          <NetworkWatchdog nodes={snapshot.network_nodes} history={latencyHistory} />
        )}
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-6 text-xs text-slate-400">
        Reference demo with simulated telemetry and synthetic tags. Not connected to plant hardware
        and not a safety system.
      </footer>
    </div>
  );
}
