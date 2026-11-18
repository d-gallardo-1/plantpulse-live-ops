import { CheckCircle2, FilterX } from 'lucide-react';
import { useMemo } from 'react';
import { useAction } from '../hooks/useAction';
import { api } from '../lib/api';
import type { CauseEffectRule, PlantSnapshot } from '../types/telemetry';
import { AlarmCard } from './alarms/AlarmCard';
import { AlarmHistory } from './alarms/AlarmHistory';
import { DemoControls } from './alarms/DemoControls';
import { EventLog } from './alarms/EventLog';

interface Props {
  snapshot: PlantSnapshot;
  rules: CauseEffectRule[];
  selectedStationId: string | null;
  onClearFilter: () => void;
}

/** Live Alarm Diagnostics (orchestrator): cause-and-effect feed plus demo controls. */
export function LiveAlarmDiagnostics({ snapshot, rules, selectedStationId, onClearFilter }: Props) {
  const { pending, error, run } = useAction();

  const activeCodes = useMemo(
    () => new Set(snapshot.active_alarms.map((alarm) => alarm.rule.alarm_code)),
    [snapshot.active_alarms],
  );
  const visible = selectedStationId
    ? snapshot.active_alarms.filter((alarm) => alarm.rule.station_id === selectedStationId)
    : snapshot.active_alarms;
  const hidden = snapshot.active_alarms.length - visible.length;
  const unacknowledged = visible.filter((alarm) => alarm.acknowledged_at === null).length;
  const station = snapshot.stations.find((item) => item.station_id === selectedStationId);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-labelledby="feed-title" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="feed-title" className="panel-title">
            Real-Time Cause &amp; Effect Diagnostic Feed
          </h2>
          <span className="font-mono text-xs text-slate-400">
            {visible.length} active · {unacknowledged} unacknowledged
            {hidden > 0 ? ` · ${hidden} hidden by filter` : ''}
          </span>
        </div>

        {station && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-link/50 bg-link/10 px-3 py-2 text-sm text-slate-200">
            Showing only <span className="font-mono text-link">{station.station_id}</span> {station.name}
            <button type="button" className="btn ml-auto px-2 py-1 text-xs" onClick={onClearFilter}>
              <FilterX aria-hidden="true" className="h-3.5 w-3.5" />
              Show all stations
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="panel flex items-center gap-3 p-4 text-sm text-slate-300">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-nominal" />
            {station
              ? `No active alarms at ${station.name}.`
              : 'No active alarms. Use the demo controls to inject a fault.'}
          </div>
        ) : (
          visible.map((alarm) => (
            <AlarmCard
              key={alarm.event_id}
              alarm={alarm}
              pending={pending}
              onAcknowledge={(code) => run(`ack-${code}`, () => api.acknowledge(code))}
              onClear={(code) => run(`clear-${code}`, () => api.clear(code))}
            />
          ))
        )}

        <AlarmHistory entries={snapshot.alarm_history} />
      </section>

      <aside className="space-y-4">
        <DemoControls
          autoCycle={snapshot.auto_cycle}
          rules={rules}
          activeCodes={activeCodes}
          pending={pending}
          error={error}
          run={run}
        />
        <EventLog events={snapshot.event_log} />
      </aside>
    </div>
  );
}
