import { formatTime } from '../../lib/api';
import type { EventKind, PlantEvent } from '../../types/telemetry';

const KIND_CLASSES: Record<EventKind, string> = {
  RAISED: 'text-red-400',
  ACKNOWLEDGED: 'text-link',
  CLEARED: 'text-nominal',
  RESET: 'text-nominal',
  AUTO_CYCLE: 'text-link',
  NETWORK: 'text-warn',
  MATRIX: 'text-link',
};

/** Rolling log of recent plant events, newest first. */
export function EventLog({ events }: { events: PlantEvent[] }) {
  return (
    <section className="panel p-3" aria-labelledby="event-log-title">
      <h2 id="event-log-title" className="panel-title mb-2">
        Recent Events
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">No events recorded yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {events.slice(0, 10).map((event) => (
            <li key={event.event_id} className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-2 text-xs">
              <time className="font-mono text-slate-400">{formatTime(event.timestamp)}</time>
              <span className={`font-mono font-semibold ${KIND_CLASSES[event.kind]}`}>{event.kind}</span>
              <span className="text-slate-300">{event.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
