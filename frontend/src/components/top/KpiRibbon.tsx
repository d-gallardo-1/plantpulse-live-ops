import { Gauge, Lock, Target, Timer, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { TONE_CLASSES, type Tone } from '../../lib/statusMeta';
import type { Kpis, StreamStatus } from '../../types/telemetry';
import { StatusBadge } from '../shared/StatusBadge';

interface TileProps {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  children: ReactNode;
  note?: ReactNode;
}

function Tile({ label, icon: Icon, tone, children, note }: TileProps) {
  return (
    <div className="panel flex min-w-0 flex-col gap-1 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${TONE_CLASSES[tone].text}`} />
        <span className="panel-title truncate">{label}</span>
      </div>
      <div className="font-mono text-2xl font-semibold leading-tight text-slate-50">{children}</div>
      <div className="min-h-[18px] text-xs text-slate-400">{note}</div>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="h-1 w-full" aria-hidden="true">
      <rect width="100" height="4" rx="2" className="fill-edge" />
      <rect width={ratio * 100} height="4" rx="2" className="fill-link" />
    </svg>
  );
}

const oeeTone = (oee: number): Tone => (oee >= 80 ? 'nominal' : oee >= 60 ? 'warn' : 'critical');

interface Props {
  kpis: Kpis | null;
  streamStatus: StreamStatus;
  sequence: number | null;
}

export function KpiRibbon({ kpis, streamStatus, sequence }: Props) {
  const latency = kpis?.gateway_latency_ms ?? null;
  const interlocks = kpis?.active_interlocks ?? 0;

  return (
    <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      <Tile label="Active Line OEE" icon={Gauge} tone={kpis ? oeeTone(kpis.oee_pct) : 'link'} note="Simulated value">
        {kpis ? `${kpis.oee_pct.toFixed(1)} %` : '--'}
      </Tile>

      <Tile
        label="Cycle Output vs Shift Target"
        icon={Target}
        tone="link"
        note={kpis ? <ProgressBar value={kpis.cycle_output} max={kpis.shift_target} /> : null}
      >
        {kpis ? (
          <>
            {kpis.cycle_output}
            <span className="text-base text-slate-400"> / {kpis.shift_target} seg</span>
          </>
        ) : (
          '--'
        )}
      </Tile>

      <Tile
        label="Active Interlocks"
        icon={Lock}
        tone={interlocks > 0 ? 'critical' : 'nominal'}
        note={interlocks > 0 ? 'Interlock effects in force' : 'No interlocks in force'}
      >
        {kpis ? interlocks : '--'}
      </Tile>

      <Tile
        label="On-Prem Gateway Latency"
        icon={Timer}
        tone={latency === null ? 'critical' : latency > 40 ? 'warn' : 'link'}
        note="GW-EDGE-01 round trip"
      >
        {!kpis ? '--' : latency === null ? 'NO LINK' : `${latency.toFixed(1)} ms`}
      </Tile>

      <div className="panel col-span-2 flex flex-col gap-1 px-3 py-2.5 md:col-span-1">
        <span className="panel-title">SSE Stream Health</span>
        <div className="pt-0.5" role="status" aria-live="polite">
          <StatusBadge status={streamStatus} />
        </div>
        <div className="font-mono text-xs text-slate-400">
          {sequence === null ? 'waiting for first snapshot' : `snapshot #${sequence}`}
        </div>
      </div>
    </section>
  );
}
