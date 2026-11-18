import { describe, expect, it, vi } from 'vitest';
import { MAX_AUTO_ALARMS } from './alarmBook';
import { DATASET } from './dataset';
import { AUTO_EVENT_EVERY_TICKS, DemoEngine } from './engine';

const CRITICAL = DATASET.rules.find((rule) => rule.severity === 'CRITICAL')!;
const WARNING = DATASET.rules.find((rule) => rule.severity === 'WARNING')!;

/** An engine with a fixed clock and a constant random draw (0.5 unless told otherwise). */
function makeEngine(random: () => number = () => 0.5) {
  return new DemoEngine(DATASET, { random, now: () => '2026-11-18T10:00:00.000Z' });
}

const stepUntilAutoEvent = (engine: DemoEngine) => {
  for (let tick = 0; tick < AUTO_EVENT_EVERY_TICKS; tick += 1) engine.step();
};

describe('DemoEngine', () => {
  it('uses the exported backend dataset', () => {
    expect(DATASET.stations.map((station) => station.station_id)).toEqual(
      ['STN-01', 'STN-02', 'STN-03', 'STN-04', 'STN-05', 'STN-06', 'STN-07'],
    );
    expect(DATASET.rules).toHaveLength(12);
    expect(DATASET.rules.every((rule) => /^ALM-\d{3}$/.test(rule.alarm_code))).toBe(true);
    expect(DATASET.nodes.some((node) => node.node_id === DATASET.gateway_node_id)).toBe(true);
  });

  it('starts nominal, with nothing active', () => {
    const snapshot = makeEngine().snapshot();

    expect(snapshot.simulated).toBe(true);
    expect(snapshot.active_alarms).toEqual([]);
    expect(snapshot.stations.every((station) => station.status === 'NOMINAL')).toBe(true);
    expect(snapshot.kpis.active_interlocks).toBe(0);
  });

  it('raises an alarm on its station and lowers the OEE', () => {
    const engine = makeEngine();
    const before = engine.snapshot().kpis.oee_pct;

    engine.trigger(CRITICAL.alarm_code);
    const snapshot = engine.snapshot();

    const station = snapshot.stations.find((s) => s.station_id === CRITICAL.station_id)!;
    expect(station.status).toBe('CRITICAL');
    expect(station.active_alarm_codes).toEqual([CRITICAL.alarm_code]);
    expect(snapshot.kpis.active_interlocks).toBe(1);
    expect(snapshot.kpis.oee_pct).toBe(before - 22);
    expect(snapshot.event_log[0].kind).toBe('RAISED');
  });

  it('keeps an acknowledged alarm active and records the lifecycle when cleared', () => {
    const engine = makeEngine();
    engine.trigger(WARNING.alarm_code);

    engine.acknowledge(WARNING.alarm_code);
    expect(engine.snapshot().active_alarms[0].acknowledged_at).not.toBeNull();

    expect(engine.clear(WARNING.alarm_code)).toBe(true);
    const snapshot = engine.snapshot();
    expect(snapshot.active_alarms).toEqual([]);
    expect(snapshot.alarm_history[0]).toMatchObject({
      alarm_code: WARNING.alarm_code,
      source: 'MANUAL',
      acknowledged_at: '2026-11-18T10:00:00.000Z',
    });
    expect(engine.clear(WARNING.alarm_code)).toBe(false);
  });

  it('rejects unknown codes and acknowledging an alarm that is not active', () => {
    const engine = makeEngine();

    expect(() => engine.trigger('ALM-999')).toThrow('Unknown alarm code: ALM-999');
    expect(() => engine.acknowledge(WARNING.alarm_code)).toThrow('is not active');
  });

  it('freezes the segment counter while a critical alarm stops the line', () => {
    const engine = makeEngine();
    engine.setAutoCycle(false);
    const start = engine.snapshot().kpis.cycle_output;

    engine.trigger(CRITICAL.alarm_code);
    for (let tick = 0; tick < 16; tick += 1) engine.step();
    expect(engine.snapshot().kpis.cycle_output).toBe(start);

    engine.clear(CRITICAL.alarm_code);
    for (let tick = 0; tick < 16; tick += 1) engine.step();
    expect(engine.snapshot().kpis.cycle_output).toBe(start + 2);
  });

  it('lets the background generator raise at most its limit and never touch manual alarms', () => {
    const engine = makeEngine(() => 0.99); // never clears by chance, never blips
    engine.trigger(CRITICAL.alarm_code); // manual

    for (let round = 0; round < 6; round += 1) stepUntilAutoEvent(engine);
    const active = engine.snapshot().active_alarms;

    expect(active.filter((alarm) => alarm.source === 'AUTO').length).toBeLessThanOrEqual(MAX_AUTO_ALARMS);
    expect(active.some((alarm) => alarm.rule.alarm_code === CRITICAL.alarm_code)).toBe(true);
  });

  it('hands an automatic alarm over to the operator who triggers it by hand', () => {
    const engine = makeEngine(() => 0.99);
    stepUntilAutoEvent(engine);
    const raised = engine.snapshot().active_alarms[0];
    expect(raised.source).toBe('AUTO');

    engine.trigger(raised.rule.alarm_code);

    expect(engine.snapshot().active_alarms[0].source).toBe('MANUAL');
  });

  it('forces a network node offline and restores everything on reset', () => {
    const engine = makeEngine();
    const gateway = DATASET.gateway_node_id;

    engine.setNodeStatus(gateway, 'OFFLINE');
    engine.trigger(WARNING.alarm_code);
    let snapshot = engine.snapshot();
    expect(snapshot.kpis.gateway_latency_ms).toBeNull();
    expect(snapshot.network_nodes.find((n) => n.node_id === gateway)).toMatchObject({
      status: 'OFFLINE',
      forced: true,
      packet_loss_pct: 100,
    });

    engine.reset();
    snapshot = engine.snapshot();
    expect(snapshot.active_alarms).toEqual([]);
    expect(snapshot.network_nodes.every((n) => n.status === 'ONLINE' && !n.forced)).toBe(true);
    expect(() => engine.setNodeStatus('NOPE-01', 'OFFLINE')).toThrow('Unknown network node');
  });

  it('publishes a numbered snapshot to subscribers until they unsubscribe', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    engine.step();
    engine.publish();
    unsubscribe();
    engine.publish();

    expect(listener.mock.calls.map(([snapshot]) => snapshot.sequence)).toEqual([1, 2]);
  });

  it('pauses simulated events while the auto-cycle is off', () => {
    const engine = makeEngine(() => 0.99);
    engine.setAutoCycle(false);

    for (let round = 0; round < 3; round += 1) stepUntilAutoEvent(engine);

    expect(engine.snapshot().active_alarms).toEqual([]);
    expect(engine.snapshot().auto_cycle).toBe(false);
  });

  it('clears active alarms and bumps the revision when the matrix is restored', () => {
    const engine = makeEngine();
    engine.trigger(WARNING.alarm_code);

    expect(engine.restoreDefaultRules()).toEqual([WARNING.alarm_code]);

    const snapshot = engine.snapshot();
    expect(snapshot.matrix_revision).toBe(1);
    expect(snapshot.active_alarms).toEqual([]);
    expect(snapshot.event_log[0].kind).toBe('MATRIX');
  });
});
