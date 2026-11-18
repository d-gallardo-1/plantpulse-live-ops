import type { ActiveAlarm, CauseEffectRule, PlantSnapshot } from '../types/telemetry';

/** Builds a rule; pass only the fields a test cares about. */
export function makeRule(overrides: Partial<CauseEffectRule> = {}): CauseEffectRule {
  return {
    alarm_code: 'ALM-207',
    station_id: 'STN-03',
    station_name: 'Concrete Casting & Vibration',
    severity: 'CRITICAL',
    title: 'Hopper Discharge Gate Failed to Close',
    root_cause: 'The closed-position switch was not made after the close command.',
    trip_condition: 'Closed position not reached within 3 s',
    device_tag: 'ZS-309',
    device_description: 'Position switch closed, hopper discharge gate',
    plc_input: 'R2.S2.DI07',
    cabinet: 'CP-03',
    junction_box: 'JB-309',
    interlock_effect: 'Locks carousel advance.',
    affected_output: 'R2.S6.DO01',
    affected_output_description: 'Carousel advance permit',
    recommended_action: 'Stop the feed and clear the obstruction.',
    ...overrides,
  };
}

export function makeAlarm(overrides: Partial<ActiveAlarm> = {}): ActiveAlarm {
  return {
    event_id: 'EVT-000001',
    raised_at: '2026-11-18T10:00:00Z',
    source: 'MANUAL',
    rule: makeRule(),
    acknowledged_at: null,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<PlantSnapshot> = {}): PlantSnapshot {
  return {
    facility: 'Test Facility',
    simulated: true,
    sequence: 1,
    timestamp: '2026-11-18T10:00:00Z',
    auto_cycle: false,
    stations: [],
    active_alarms: [],
    network_nodes: [],
    kpis: {
      oee_pct: 86.5,
      cycle_output: 41,
      shift_target: 96,
      active_interlocks: 0,
      gateway_latency_ms: 7.5,
    },
    event_log: [],
    alarm_history: [],
    matrix_revision: 0,
    matrix_source: 'Built-in sample matrix',
    ...overrides,
  };
}
