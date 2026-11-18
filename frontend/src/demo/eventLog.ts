import type { AlarmSource, CauseEffectRule, EventKind, PlantEvent } from '../types/telemetry';

const LOG_SIZE = 25;

/** Source of random numbers in [0, 1); tests pass a fixed sequence. */
export type Random = () => number;

/** Current time as an ISO string; tests pass a fixed clock. */
export type Clock = () => string;

export const uniform = (random: Random, low: number, high: number) => low + (high - low) * random();
export const roundTo1 = (value: number) => Math.round(value * 10) / 10;

/** Keeps the most recent plant events, newest first. Mirrors simulation/events.py. */
export class EventLog {
  private nextNumber = 1;
  private events: PlantEvent[] = [];

  constructor(readonly now: Clock) {}

  nextId(prefix: string): string {
    const id = `${prefix}-${String(this.nextNumber).padStart(6, '0')}`;
    this.nextNumber += 1;
    return id;
  }

  add(kind: EventKind, message: string, rule?: CauseEffectRule, source?: AlarmSource): void {
    this.events.unshift({
      event_id: this.nextId('LOG'),
      timestamp: this.now(),
      kind,
      message,
      alarm_code: rule?.alarm_code ?? null,
      station_id: rule?.station_id ?? null,
      severity: rule?.severity ?? null,
      source: source ?? null,
    });
    this.events.length = Math.min(this.events.length, LOG_SIZE);
  }

  entries(): PlantEvent[] {
    return [...this.events];
  }
}
