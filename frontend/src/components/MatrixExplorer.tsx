import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAction } from '../hooks/useAction';
import { api } from '../lib/api';
import { filterRules } from '../lib/search';
import type { CauseEffectRule, StationState } from '../types/telemetry';
import { MatrixToolbar } from './matrix/MatrixToolbar';
import { RuleCard } from './matrix/RuleCard';

interface Props {
  rules: CauseEffectRule[];
  stations: StationState[];
  activeCodes: Set<string>;
  matrixSource: string;
  /** Why the matrix could not be loaded from the backend, or null. */
  loadError: string | null;
}

/** Cause & Effect Matrix Explorer (orchestrator): instant search over every tag. */
export function MatrixExplorer({ rules, stations, activeCodes, matrixSource, loadError }: Props) {
  const [query, setQuery] = useState('');
  const [stationId, setStationId] = useState<string | null>(null);
  const { pending, error, run } = useAction();
  const results = useMemo(() => filterRules(rules, query, stationId), [rules, query, stationId]);

  return (
    <section aria-labelledby="matrix-title" className="space-y-3">
      <div className="panel space-y-3 p-3">
        <h2 id="matrix-title" className="panel-title">
          Cause &amp; Effect Matrix Explorer
        </h2>
        <MatrixToolbar matrixSource={matrixSource} pending={pending} run={run} />

        <label className="relative block">
          <span className="sr-only">Search the matrix</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by alarm code, PLC tag (R2.S2.DI07), device tag (PT-618), cabinet (CP-03)…"
            className="w-full rounded-md border border-edge bg-obsidian py-2 pl-9 pr-3 font-mono text-sm text-slate-100 placeholder:font-sans placeholder:text-slate-400"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by station">
          <button
            type="button"
            aria-pressed={stationId === null}
            onClick={() => setStationId(null)}
            className={`rounded border px-2 py-1 text-xs ${
              stationId === null ? 'border-link/60 bg-link/10 text-link' : 'border-edge text-slate-300 hover:border-slate-500'
            }`}
          >
            All stations
          </button>
          {stations.map((station) => (
            <button
              key={station.station_id}
              type="button"
              aria-pressed={stationId === station.station_id}
              title={station.name}
              onClick={() => setStationId(station.station_id)}
              className={`rounded border px-2 py-1 font-mono text-xs ${
                stationId === station.station_id
                  ? 'border-link/60 bg-link/10 text-link'
                  : 'border-edge text-slate-300 hover:border-slate-500'
              }`}
            >
              {station.station_id}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-slate-400" role="status">
            {results.length} of {rules.length} rules
          </span>
        </div>

        {error && (
          <p role="alert" className="rounded border border-critical/50 bg-critical/10 px-2 py-1.5 text-xs text-critical">
            Command failed: {error}
          </p>
        )}
      </div>

      {loadError && (
        <p role="alert" className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
          Could not load the matrix from the backend ({loadError}). Retrying automatically
          {rules.length > 0 ? '; the rules below are the last ones loaded and may be out of date.' : '.'}
        </p>
      )}

      {results.length === 0 ? (
        <p className="panel p-4 text-sm text-slate-300">
          {rules.length === 0
            ? loadError
              ? 'No matrix is available yet.'
              : 'Loading the matrix from the backend…'
            : 'No rule matches that search. Try a shorter tag, for example “JB-5” or “vacuum”.'}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {results.map((rule) => (
            <RuleCard
              key={rule.alarm_code}
              rule={rule}
              active={activeCodes.has(rule.alarm_code)}
              pending={pending.has(rule.alarm_code)}
              onTrigger={(code) => run(code, () => api.trigger(code))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
