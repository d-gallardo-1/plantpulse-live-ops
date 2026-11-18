import { Zap } from 'lucide-react';
import type { CauseEffectRule } from '../../types/telemetry';
import { StatusBadge } from '../shared/StatusBadge';

interface Props {
  rule: CauseEffectRule;
  active: boolean;
  pending: boolean;
  onTrigger: (alarmCode: string) => void;
}

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="tag">{value}</dd>
      {note && <dd className="text-xs text-slate-400">{note}</dd>}
    </div>
  );
}

/** A matrix row rendered as a readable relationship card. */
export function RuleCard({ rule, active, pending, onTrigger }: Props) {
  return (
    <article className="panel flex flex-col gap-3 p-3" aria-label={`${rule.alarm_code} ${rule.title}`}>
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-slate-50">
            <span className="font-mono">{rule.alarm_code}</span> · {rule.title}
          </h3>
          <p className="text-xs text-slate-400">
            <span className="font-mono">{rule.station_id}</span> {rule.station_name}
          </p>
        </div>
        <StatusBadge status={rule.severity} compact />
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="Device tag" value={rule.device_tag} note={rule.device_description} />
        <Field label="Trip condition" value={rule.trip_condition} />
        <Field label="PLC input" value={rule.plc_input} />
        <Field label="Affected output" value={rule.affected_output} note={rule.affected_output_description} />
        <Field label="Cabinet" value={rule.cabinet} />
        <Field label="Junction box" value={rule.junction_box} />
      </dl>

      <div className="space-y-2 border-t border-edge pt-2 text-sm leading-snug text-slate-200">
        <p>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cause · </span>
          {rule.root_cause}
        </p>
        <p>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Effect · </span>
          {rule.interlock_effect}
        </p>
        <p>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Action · </span>
          {rule.recommended_action}
        </p>
      </div>

      <button
        type="button"
        className="btn mt-auto self-start px-2 py-1 text-xs"
        disabled={active || pending}
        onClick={() => onTrigger(rule.alarm_code)}
      >
        <Zap aria-hidden="true" className="h-3.5 w-3.5 text-warn" />
        {active ? 'Currently active' : `Trigger ${rule.alarm_code} in demo`}
      </button>
    </article>
  );
}
