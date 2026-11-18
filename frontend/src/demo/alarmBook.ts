import type {
  ActiveAlarm,
  AlarmHistoryEntry,
  AlarmSource,
  CauseEffectRule,
} from '../types/telemetry';
import type { EventLog, Random } from './eventLog';

/** Maximum number of alarms the background generator keeps active at once. */
export const MAX_AUTO_ALARMS = 2;

const HISTORY_SIZE = 20;

/**
 * Alarm lifecycle (raised -> acknowledged -> cleared) and the event generator.
 * Mirrors backend/app/simulation/alarms.py.
 */
export class AlarmBook {
  private rulesByCode = new Map<string, CauseEffectRule>();
  // Insertion order is the order in which the alarms were raised.
  private activeByCode = new Map<string, ActiveAlarm>();
  private cleared: AlarmHistoryEntry[] = [];

  constructor(rules: CauseEffectRule[], private readonly log: EventLog) {
    this.setRules(rules);
  }

  get rules(): CauseEffectRule[] {
    return [...this.rulesByCode.values()];
  }

  /** Active alarms, most recent first. */
  active(): ActiveAlarm[] {
    return [...this.activeByCode.values()].reverse();
  }

  /** Cleared alarms, most recently cleared first. */
  history(): AlarmHistoryEntry[] {
    return [...this.cleared];
  }

  lineStopped(): boolean {
    return this.active().some((alarm) => alarm.rule.severity === 'CRITICAL');
  }

  /** Trips an alarm; tripping an active one again changes nothing but its owner. */
  trigger(alarmCode: string, source: AlarmSource): ActiveAlarm {
    const rule = this.ruleFor(alarmCode);
    const existing = this.activeByCode.get(alarmCode);
    if (existing) {
      if (source === 'MANUAL' && existing.source === 'AUTO') {
        // A manual trigger takes ownership, so the background generator can
        // no longer clear this alarm on its own.
        const owned: ActiveAlarm = { ...existing, source: 'MANUAL' };
        this.activeByCode.set(alarmCode, owned);
        return owned;
      }
      return existing;
    }
    const alarm: ActiveAlarm = {
      event_id: this.log.nextId('EVT'),
      raised_at: this.log.now(),
      source,
      rule,
      acknowledged_at: null,
    };
    this.activeByCode.set(alarmCode, alarm);
    this.log.add('RAISED', `${rule.alarm_code} raised at ${rule.station_id}: ${rule.title}`, rule, source);
    return alarm;
  }

  /** Marks an active alarm as seen. It stays active and keeps its interlock. */
  acknowledge(alarmCode: string): ActiveAlarm {
    this.ruleFor(alarmCode);
    const alarm = this.activeByCode.get(alarmCode);
    if (!alarm) throw new Error(`Alarm ${alarmCode} is not active.`);
    if (alarm.acknowledged_at !== null) return alarm;
    const acknowledged: ActiveAlarm = { ...alarm, acknowledged_at: this.log.now() };
    this.activeByCode.set(alarmCode, acknowledged);
    this.log.add(
      'ACKNOWLEDGED',
      `${alarmCode} acknowledged at ${alarm.rule.station_id}`,
      alarm.rule,
      alarm.source,
    );
    return acknowledged;
  }

  /** Clears one alarm into the history. Returns false when it was not active. */
  clear(alarmCode: string): boolean {
    this.ruleFor(alarmCode);
    const alarm = this.activeByCode.get(alarmCode);
    if (!alarm) return false;
    this.activeByCode.delete(alarmCode);
    this.archive(alarm);
    this.log.add(
      'CLEARED',
      `${alarm.rule.alarm_code} cleared at ${alarm.rule.station_id}`,
      alarm.rule,
      alarm.source,
    );
    return true;
  }

  clearAll(): number {
    const alarms = [...this.activeByCode.values()]; // oldest first, so history keeps its order
    alarms.forEach((alarm) => this.archive(alarm));
    this.activeByCode.clear();
    return alarms.length;
  }

  /** Swaps the matrix. Active alarms are cleared, because their trace may have changed. */
  replaceRules(rules: CauseEffectRule[]): string[] {
    const cleared = [...this.activeByCode.keys()].sort();
    this.clearAll();
    this.setRules(rules);
    return cleared;
  }

  /** Raises or clears one simulated alarm. Manually injected alarms are never touched. */
  autoStep(random: Random): void {
    const auto = [...this.activeByCode.values()].filter((alarm) => alarm.source === 'AUTO');
    if (auto.length > 0 && (auto.length >= MAX_AUTO_ALARMS || random() < 0.5)) {
      this.clear(auto[0].rule.alarm_code); // the oldest one
      return;
    }
    const candidates = this.rules.filter((rule) => !this.activeByCode.has(rule.alarm_code));
    if (candidates.length === 0) return;
    const pick = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    this.trigger(pick.alarm_code, 'AUTO');
  }

  private setRules(rules: CauseEffectRule[]): void {
    this.rulesByCode = new Map(rules.map((rule) => [rule.alarm_code, rule]));
  }

  private ruleFor(alarmCode: string): CauseEffectRule {
    const rule = this.rulesByCode.get(alarmCode);
    if (!rule) throw new Error(`Unknown alarm code: ${alarmCode}`);
    return rule;
  }

  private archive(alarm: ActiveAlarm): void {
    this.cleared.unshift({
      event_id: alarm.event_id,
      alarm_code: alarm.rule.alarm_code,
      title: alarm.rule.title,
      station_id: alarm.rule.station_id,
      severity: alarm.rule.severity,
      source: alarm.source,
      raised_at: alarm.raised_at,
      acknowledged_at: alarm.acknowledged_at,
      cleared_at: this.log.now(),
    });
    this.cleared.length = Math.min(this.cleared.length, HISTORY_SIZE);
  }
}
