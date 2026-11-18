import { useMemo, useState } from 'react';
import { LiveAlarmDiagnostics } from './components/LiveAlarmDiagnostics';
import { MatrixExplorer } from './components/MatrixExplorer';
import { NetworkWatchdog } from './components/NetworkWatchdog';
import { DemoNotice } from './components/shared/DemoNotice';
import { ProcessTopologyMap } from './components/ProcessTopologyMap';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { useLatencyHistory } from './hooks/useLatencyHistory';
import { usePlantStream } from './hooks/usePlantStream';
import { useRules } from './hooks/useRules';
import { DEMO_MODE } from './lib/demoMode';
import type { ViewId } from './types/telemetry';

/** Application shell (orchestrator): one SSE subscription feeds every view. */
export default function App() {
  const { snapshot, status } = usePlantStream();
  const { rules, loadError } = useRules(status, snapshot?.matrix_revision ?? null);
  const latencyHistory = useLatencyHistory(snapshot);
  const [view, setView] = useState<ViewId>('live');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const online = status === 'CONNECTED';
  const offline = status === 'DISCONNECTED';

  const activeCodes = useMemo(
    () => new Set((snapshot?.active_alarms ?? []).map((alarm) => alarm.rule.alarm_code)),
    [snapshot?.active_alarms],
  );

  return (
    <div className="min-h-screen">
      <TopTelemetryBar snapshot={snapshot} streamStatus={status} view={view} onViewChange={setView} />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {DEMO_MODE && <DemoNotice />}

        {!snapshot && (
          <p className="panel p-4 text-sm text-slate-300" role="status">
            {status === 'DISCONNECTED'
              ? 'Cannot reach the backend. Retrying every few seconds; check that the API is running on port 8000.'
              : 'Waiting for the first plant snapshot…'}
          </p>
        )}

        {snapshot && !online && (
          <p role="alert" className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
            {offline
              ? 'Live connection lost. The data below is the last snapshot received and may be out of date; controls are disabled until the stream is back.'
              : 'Reconnecting to the live stream. The data below may be a few seconds old.'}
          </p>
        )}

        {snapshot && (
          // A disabled fieldset disables every form control inside it, local
          // ones such as search included. That is deliberate, but only once the
          // connection is given up on: during a short reconnect an operator
          // must still be able to acknowledge an alarm.
          <fieldset disabled={offline} className="m-0 min-w-0 space-y-4 border-0 p-0">
            {view === 'live' && (
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
            )}
            {view === 'matrix' && (
              <MatrixExplorer
                rules={rules}
                stations={snapshot.stations}
                activeCodes={activeCodes}
                matrixSource={snapshot.matrix_source}
                loadError={loadError}
              />
            )}
            {view === 'network' && (
              <NetworkWatchdog nodes={snapshot.network_nodes} history={latencyHistory} />
            )}
          </fieldset>
        )}
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-6 text-xs text-slate-400">
        Reference demo with simulated telemetry and synthetic tags. Not connected to plant hardware
        and not a safety system.
      </footer>
    </div>
  );
}
