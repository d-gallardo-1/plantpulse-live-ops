import { formatTime } from '../../lib/api';
import type { AlarmHistoryEntry } from '../../types/telemetry';
import { StatusBadge } from '../shared/StatusBadge';

function duration(fromIso: string, toIso: string): string {
  const seconds = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

/** Cleared alarms with their lifecycle: raised -> acknowledged -> cleared. */
export function AlarmHistory({ entries }: { entries: AlarmHistoryEntry[] }) {
  return (
    <section className="panel p-3" aria-labelledby="history-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="history-title" className="panel-title">
          Alarm History
        </h2>
        <span className="text-xs text-slate-400">Raised → acknowledged → cleared · newest first</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No alarm has been cleared yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-edge text-[11px] uppercase tracking-wider text-slate-400">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Alarm</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Severity</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Raised</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Acknowledged</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Cleared</th>
                <th scope="col" className="py-1.5 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.event_id} className="border-b border-edge/60 align-top last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-slate-200">
                    <span className="font-mono font-semibold">{entry.alarm_code}</span> · {entry.title}
                    <span className="block text-slate-400">
                      <span className="font-mono">{entry.station_id}</span> ·{' '}
                      {entry.source === 'MANUAL' ? 'manual' : 'auto-cycle'}
                    </span>
                  </th>
                  <td className="py-1.5 pr-3">
                    <StatusBadge status={entry.severity} compact />
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-slate-200">{formatTime(entry.raised_at)}</td>
                  <td className="py-1.5 pr-3 font-mono">
                    {entry.acknowledged_at ? (
                      <span className="text-link">{formatTime(entry.acknowledged_at)}</span>
                    ) : (
                      <span className="text-warn">not acknowledged</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-slate-200">{formatTime(entry.cleared_at)}</td>
                  <td className="py-1.5 font-mono text-slate-200">
                    {duration(entry.raised_at, entry.cleared_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
