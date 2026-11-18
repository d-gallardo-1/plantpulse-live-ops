import type { ActiveAlarm, Kpis, Severity, StationState } from '../types/telemetry';
import type { StationDefinition } from './dataset';
import { roundTo1, uniform, type Random } from './eventLog';

/** OEE points lost per active alarm, by severity. */
export const OEE_PENALTY: Record<Severity, number> = { WARNING: 3, HIGH: 9, CRITICAL: 22 };

const SEVERITY_RANK: Record<Severity, number> = { WARNING: 1, HIGH: 2, CRITICAL: 3 };
const BASELINE_OEE = 86.5;
const TICKS_PER_SEGMENT = 8;
const STARTING_OUTPUT = 41;

/** Simulated production counter and KPIs. Mirrors simulation/production.py. */
export class ProductionSimulator {
  private cycleOutput: number;
  private ticksSinceSegment = 0;
  private oeeNoise = 0;

  constructor(private readonly random: Random, private readonly shiftTarget: number) {
    this.cycleOutput = Math.min(STARTING_OUTPUT, shiftTarget);
  }

  /** Advances one step. The segment counter freezes while the line is stopped. */
  tick(lineStopped: boolean): void {
    this.oeeNoise = uniform(this.random, -0.8, 0.8);
    if (lineStopped || this.cycleOutput >= this.shiftTarget) return;
    this.ticksSinceSegment += 1;
    if (this.ticksSinceSegment >= TICKS_PER_SEGMENT) {
      this.ticksSinceSegment = 0;
      this.cycleOutput += 1;
    }
  }

  kpis(active: ActiveAlarm[], gatewayLatencyMs: number | null): Kpis {
    const penalty = active.reduce((sum, alarm) => sum + OEE_PENALTY[alarm.rule.severity], 0);
    const oee = Math.max(0, Math.min(100, BASELINE_OEE + this.oeeNoise - penalty));
    return {
      oee_pct: roundTo1(oee),
      cycle_output: this.cycleOutput,
      shift_target: this.shiftTarget,
      active_interlocks: active.length,
      gateway_latency_ms: gatewayLatencyMs,
    };
  }
}

/** A station reports the worst severity among its active alarms. Mirrors simulation/views.py. */
export function buildStationStates(
  stations: StationDefinition[],
  active: ActiveAlarm[],
): StationState[] {
  return stations.map((station) => {
    const alarms = active.filter((alarm) => alarm.rule.station_id === station.station_id);
    const worst = alarms.reduce<Severity | null>(
      (current, alarm) =>
        current === null || SEVERITY_RANK[alarm.rule.severity] > SEVERITY_RANK[current]
          ? alarm.rule.severity
          : current,
      null,
    );
    return {
      ...station,
      status: worst ?? 'NOMINAL',
      active_alarm_codes: alarms.map((alarm) => alarm.rule.alarm_code).sort(),
    };
  });
}
