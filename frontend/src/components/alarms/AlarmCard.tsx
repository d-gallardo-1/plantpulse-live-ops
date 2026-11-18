import { BellRing, Check, CheckCheck, X } from 'lucide-react';
import { formatTime } from '../../lib/api';
import { STATUS_META, TONE_CLASSES } from '../../lib/statusMeta';
import type { ActiveAlarm } from '../../types/telemetry';
import { StatusBadge } from '../shared/StatusBadge';
import { TraceMatrix } from './TraceMatrix';

interface Props {
  alarm: ActiveAlarm;
  pending: ReadonlySet<string>;
  onAcknowledge: (alarmCode: string) => void;
  onClear: (alarmCode: string) => void;
}

/**
 * One active alarm with its traceability matrix already expanded.
 * Unacknowledged alarms draw attention (glow, pulsing marker); once an operator
 * acknowledges, the card goes steady but stays until the alarm is cleared.
 */
export function AlarmCard({ alarm, pending, onAcknowledge, onClear }: Props) {
  const { rule } = alarm;
  const tone = TONE_CLASSES[STATUS_META[rule.severity].tone];
  const acknowledged = alarm.acknowledged_at !== null;
  const glow = !acknowledged && rule.severity === 'CRITICAL' ? 'shadow-glow-critical' : '';

  return (
    <article
      aria-label={`${rule.alarm_code} ${rule.title}`}
      className={`rounded-lg border bg-panel p-3 ${tone.border} ${glow}`}
    >
      <header className="mb-3 flex flex-wrap items-start gap-x-3 gap-y-2">
        <StatusBadge status={rule.severity} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-slate-50">
            <span className="font-mono">{rule.alarm_code}</span> · {rule.title}
          </h3>
          <p className="text-xs text-slate-400">
            <span className="font-mono">{rule.station_id}</span> {rule.station_name} · raised{' '}
            <time className="font-mono">{formatTime(alarm.raised_at)}</time> ·{' '}
            {alarm.source === 'MANUAL' ? 'injected manually' : 'auto-cycle simulation'} ·{' '}
            <span className="font-mono">{alarm.event_id}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {alarm.acknowledged_at ? (
            <span className="inline-flex items-center gap-1.5 rounded border border-link/50 bg-link/10 px-2 py-1 font-mono text-[11px] font-semibold text-link">
              <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
              ACKNOWLEDGED {formatTime(alarm.acknowledged_at)}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded border border-warn/50 bg-warn/10 px-2 py-1 font-mono text-[11px] font-semibold text-warn">
                <BellRing aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-pulse" />
                UNACKNOWLEDGED
              </span>
              <button
                type="button"
                className="btn border-link/50 px-2 py-1 text-xs text-link hover:border-link"
                disabled={pending.has(`ack-${rule.alarm_code}`)}
                onClick={() => onAcknowledge(rule.alarm_code)}
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                Acknowledge
              </button>
            </>
          )}
          <button
            type="button"
            className="btn px-2 py-1 text-xs"
            disabled={pending.has(`clear-${rule.alarm_code}`)}
            onClick={() => onClear(rule.alarm_code)}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear {rule.alarm_code}
          </button>
        </div>
      </header>
      <TraceMatrix rule={rule} />
    </article>
  );
}
