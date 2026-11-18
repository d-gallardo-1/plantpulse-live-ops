import { Activity, FlaskConical } from 'lucide-react';
import { formatTime } from '../lib/api';
import type { PlantSnapshot, StreamStatus, ViewId } from '../types/telemetry';
import { KpiRibbon } from './top/KpiRibbon';
import { LiveTicker } from './top/LiveTicker';
import { ViewTabs } from './top/ViewTabs';

interface Props {
  snapshot: PlantSnapshot | null;
  streamStatus: StreamStatus;
  view: ViewId;
  onViewChange: (view: ViewId) => void;
}

/** Top bar (orchestrator): identity, navigation, KPI ribbon and live ticker. */
export function TopTelemetryBar({ snapshot, streamStatus, view, onViewChange }: Props) {
  return (
    // Only the identity row is sticky; a sticky KPI ribbon would cover most of a
    // small control-room display.
    <header className="contents">
      <div className="sticky top-0 z-20 border-b border-edge bg-obsidian/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-link/50 bg-link/10">
            <Activity aria-hidden="true" className="h-5 w-5 text-link" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-slate-50">PlantPulse Live-Ops</h1>
            <p className="text-xs text-slate-400">
              {snapshot?.facility ?? 'Connecting to plant stream…'}
            </p>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded border border-warn/50 bg-warn/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-warn"
          title="All telemetry and tags are synthetic. This demo is not connected to plant hardware."
        >
          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
          Simulated demo data
        </span>

        <div className="order-last w-full md:order-none md:ml-auto md:w-auto">
          <ViewTabs view={view} onChange={onViewChange} />
        </div>

        <time className="ml-auto font-mono text-sm text-slate-300 md:ml-0">
          {snapshot ? formatTime(snapshot.timestamp) : '--:--:--'}
        </time>
      </div>
      </div>

      <div className="border-b border-edge">
        <div className="mx-auto max-w-[1600px] px-4 py-2.5">
          <KpiRibbon
            kpis={snapshot?.kpis ?? null}
            streamStatus={streamStatus}
            sequence={snapshot?.sequence ?? null}
          />
        </div>
        <div className="mx-auto max-w-[1600px]">
          <LiveTicker events={snapshot?.event_log ?? []} />
        </div>
      </div>
    </header>
  );
}
