import { ChevronRight } from 'lucide-react';
import { STATUS_META, TONE_CLASSES } from '../lib/statusMeta';
import type { StationState } from '../types/telemetry';
import { StatusBadge } from './shared/StatusBadge';

interface Props {
  stations: StationState[];
  selectedStationId: string | null;
  onSelect: (stationId: string | null) => void;
}

/** Horizontal process flow. Clicking a station filters the diagnostic feed. */
export function ProcessTopologyMap({ stations, selectedStationId, onSelect }: Props) {
  return (
    <section className="panel p-3" aria-labelledby="topology-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="topology-title" className="panel-title">
          Plant Line Topology
        </h2>
        <p className="text-xs text-slate-400">
          Select a station to filter the diagnostic feed. Select it again to clear the filter.
        </p>
      </div>

      <ol className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stations.map((station, index) => {
          const selected = station.station_id === selectedStationId;
          const tone = TONE_CLASSES[STATUS_META[station.status].tone];
          const faulted = station.status !== 'NOMINAL';
          const alarmCount = station.active_alarm_codes.length;
          return (
            <li key={station.station_id} className="flex min-w-[168px] flex-1 items-stretch gap-1">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : station.station_id)}
                title={station.description}
                className={`flex w-full flex-col gap-2 rounded-md border bg-obsidian p-2.5 text-left transition-colors hover:bg-slate-900 ${
                  faulted ? tone.border : 'border-edge'
                } ${station.status === 'CRITICAL' ? 'shadow-glow-critical' : ''} ${
                  selected ? 'ring-2 ring-link' : ''
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-400">
                    {String(station.sequence).padStart(2, '0')} · {station.station_id}
                  </span>
                  {alarmCount > 0 && (
                    <span className={`font-mono text-xs font-semibold ${tone.text}`}>
                      {alarmCount} alarm{alarmCount > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="text-sm font-medium leading-snug text-slate-100">{station.name}</span>
                <span className="mt-auto">
                  <StatusBadge status={station.status} compact />
                </span>
                {alarmCount > 0 && (
                  <span className="font-mono text-[11px] text-slate-300">
                    {station.active_alarm_codes.join(' · ')}
                  </span>
                )}
              </button>
              {index < stations.length - 1 && (
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-slate-600" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
