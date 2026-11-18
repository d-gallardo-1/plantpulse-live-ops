import type { ReactNode } from 'react';
import type { CauseEffectRule } from '../../types/telemetry';

interface Step {
  label: string;
  wide?: boolean;
  body: ReactNode;
}

function steps(rule: CauseEffectRule): Step[] {
  return [
    {
      label: 'Alarm Code',
      body: (
        <>
          <span className="tag">{rule.alarm_code}</span>
          <span className="block text-slate-300">{rule.title}</span>
        </>
      ),
    },
    {
      label: 'Root Cause',
      body: (
        <>
          {rule.root_cause}
          <span className="mt-1 block text-slate-400">
            Trip condition: <span className="font-mono text-slate-200">{rule.trip_condition}</span>
          </span>
        </>
      ),
    },
    { label: 'System Interlock Effect', body: rule.interlock_effect },
    {
      label: 'Physical Instrument Tag',
      body: (
        <>
          <span className="tag">{rule.device_tag}</span>
          <span className="block text-slate-300">{rule.device_description}</span>
        </>
      ),
    },
    {
      label: 'PLC I/O Address',
      body: (
        <>
          <span className="tag">{rule.plc_input}</span>
          <span className="mt-1 block text-slate-400">
            Affected output: <span className="font-mono text-slate-200">{rule.affected_output}</span>{' '}
            ({rule.affected_output_description})
          </span>
        </>
      ),
    },
    {
      label: 'Control Cabinet / Junction Box',
      body: (
        <span className="tag">
          {rule.cabinet} / {rule.junction_box}
        </span>
      ),
    },
    { label: 'Recommended Field Action', wide: true, body: rule.recommended_action },
  ];
}

/** Hardware traceability chain, from alarm code to the recommended field action. */
export function TraceMatrix({ rule }: { rule: CauseEffectRule }) {
  return (
    <ol aria-label={`Hardware traceability for ${rule.alarm_code}`} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps(rule).map((step, index) => (
        <li
          key={step.label}
          className={`rounded-md border border-edge bg-obsidian p-2.5 ${step.wide ? 'sm:col-span-2' : ''}`}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-link/50 font-mono text-[11px] text-link">
              {index + 1}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {step.label}
            </span>
          </div>
          <div className="text-sm leading-snug text-slate-200">{step.body}</div>
        </li>
      ))}
    </ol>
  );
}
