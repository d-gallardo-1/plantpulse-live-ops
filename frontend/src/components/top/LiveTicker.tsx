import { Activity } from 'lucide-react';
import { formatTime } from '../../lib/api';
import type { PlantEvent } from '../../types/telemetry';

/** One-line live status ticker: the most recent plant events. */
export function LiveTicker({ events }: { events: PlantEvent[] }) {
  const latest = events.slice(0, 3);

  return (
    <div className="flex items-center gap-3 overflow-hidden border-t border-edge px-4 py-1.5 text-xs">
      <span className="flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-wider text-link">
        <Activity aria-hidden="true" className="h-3.5 w-3.5" />
        Live
      </span>
      {/* aria-live is on the newest entry only, so screen readers are not flooded. */}
      <ul className="flex min-w-0 flex-1 gap-6 overflow-hidden whitespace-nowrap">
        {latest.length === 0 && <li className="text-slate-400">No events yet. Line running nominal.</li>}
        {latest.map((event, index) => (
          <li
            key={event.event_id}
            aria-live={index === 0 ? 'polite' : undefined}
            className={index === 0 ? 'text-slate-200' : 'hidden text-slate-400 lg:block'}
          >
            <span className="font-mono text-slate-400">{formatTime(event.timestamp)}</span>{' '}
            {event.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
