import { RotateCcw, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import type { CauseEffectRule } from '../../types/telemetry';

interface DemoFault {
  code: string;
  hint: string;
}

/** Alarms offered as one-click demo buttons when the loaded matrix has them (in matrix order). */
export const PREFERRED_FAULT_CODES = ['ALM-203', 'ALM-205', 'ALM-207', 'ALM-211'];

/**
 * The buttons only offer alarms that exist in the loaded matrix, and their text
 * is the title in that matrix, so an uploaded workbook is reflected here too.
 * When none of the preferred alarms exist, the first rules are offered instead.
 */
export function demoFaults(rules: CauseEffectRule[]): DemoFault[] {
  const preferred = rules.filter((rule) => PREFERRED_FAULT_CODES.includes(rule.alarm_code));
  const offered = preferred.length > 0 ? preferred : rules.slice(0, 4);
  return offered.map((rule) => ({ code: rule.alarm_code, hint: rule.title }));
}

interface Props {
  autoCycle: boolean;
  rules: CauseEffectRule[];
  activeCodes: Set<string>;
  pending: ReadonlySet<string>;
  error: string | null;
  run: (key: string, action: () => Promise<unknown>) => void;
}

export function DemoControls({ autoCycle, rules, activeCodes, pending, error, run }: Props) {
  const faults = demoFaults(rules);

  return (
    <section className="panel p-3" aria-labelledby="demo-title">
      <h2 id="demo-title" className="panel-title mb-1">
        Simulate Fault · Demo Controls
      </h2>
      <p className="mb-3 text-xs text-slate-400">
        Inject a fault and watch the stream respond. Nothing here reaches real equipment.
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={autoCycle}
        disabled={pending.has('auto-cycle')}
        onClick={() => run('auto-cycle', () => api.setAutoCycle(!autoCycle))}
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-md border border-edge bg-obsidian px-3 py-2 text-left hover:border-slate-500"
      >
        <span>
          <span className="block text-sm font-medium text-slate-100">Auto-Cycle Simulation</span>
          <span className="block text-xs text-slate-400">
            {autoCycle
              ? 'Background events are running. Turn off for a manual demo.'
              : 'Paused. Only your manual triggers change the plant state.'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`font-mono text-xs font-semibold ${autoCycle ? 'text-nominal' : 'text-slate-400'}`}>
            {autoCycle ? 'ON' : 'OFF'}
          </span>
          <span
            aria-hidden="true"
            className={`flex h-5 w-9 items-center rounded-full border px-0.5 transition-colors ${
              autoCycle ? 'justify-end border-nominal/60 bg-nominal/20' : 'justify-start border-edge bg-panel'
            }`}
          >
            <span className={`h-3.5 w-3.5 rounded-full ${autoCycle ? 'bg-nominal' : 'bg-slate-500'}`} />
          </span>
        </span>
      </button>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        {faults.map(({ code, hint }) => {
          const active = activeCodes.has(code);
          return (
            <button
              key={code}
              type="button"
              className="btn justify-start text-left"
              disabled={active || pending.has(code)}
              onClick={() => run(code, () => api.trigger(code))}
            >
              <Zap aria-hidden="true" className="h-4 w-4 shrink-0 text-warn" />
              <span>
                {active ? 'Active: ' : 'Trigger '}
                <span className="font-mono">{code}</span>
                <span className="block text-xs font-normal text-slate-400">({hint})</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn mt-2 w-full border-nominal/50 text-nominal hover:border-nominal"
        disabled={pending.has('reset')}
        onClick={() => run('reset', api.reset)}
      >
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
        Reset All Faults
      </button>

      {error && (
        <p role="alert" className="mt-2 rounded border border-critical/50 bg-critical/10 px-2 py-1.5 text-xs text-critical">
          Command failed: {error}
        </p>
      )}
    </section>
  );
}
