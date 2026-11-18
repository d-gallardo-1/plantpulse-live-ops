import type { AlarmSource, CauseEffectRule, NodeStatus, PlantSnapshot } from '../types/telemetry';
import { AlarmBook } from './alarmBook';
import type { DemoDataset } from './dataset';
import { EventLog, type Clock, type Random } from './eventLog';
import { NetworkSimulator } from './network';
import { buildStationStates, ProductionSimulator } from './production';

export const DEFAULT_MATRIX_SOURCE = 'Built-in sample matrix';
export const TICK_MS = 2000;
export const AUTO_EVENT_EVERY_TICKS = 6;

type Listener = (snapshot: PlantSnapshot) => void;

interface Options {
  random?: Random;
  now?: Clock;
}

/**
 * The plant simulation, running in the browser (orchestrator).
 *
 * A port of backend/app/engine.py for the build that has no backend. It
 * composes the same building blocks and produces the same PlantSnapshot, so
 * the rest of the UI cannot tell the two apart.
 */
export class DemoEngine {
  autoCycle = true;
  private readonly stations;
  private readonly defaultRules: CauseEffectRule[];
  private readonly log: EventLog;
  private readonly alarms: AlarmBook;
  private readonly network: NetworkSimulator;
  private readonly production: ProductionSimulator;
  private readonly random: Random;
  private readonly listeners = new Set<Listener>();
  private sequence = 0;
  private ticks = 0;
  private matrixRevision = 0;
  private matrixSource = DEFAULT_MATRIX_SOURCE;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly dataset: DemoDataset, options: Options = {}) {
    this.random = options.random ?? Math.random;
    this.stations = [...dataset.stations].sort((a, b) => a.sequence - b.sequence);
    this.defaultRules = [...dataset.rules];
    this.log = new EventLog(options.now ?? (() => new Date().toISOString()));
    this.alarms = new AlarmBook(this.defaultRules, this.log);
    this.network = new NetworkSimulator(dataset.nodes, this.random);
    this.production = new ProductionSimulator(this.random, dataset.shift_target);
  }

  get rules(): CauseEffectRule[] {
    return this.alarms.rules;
  }

  // --------------------------------------------------------------- commands

  trigger(alarmCode: string, source: AlarmSource = 'MANUAL'): void {
    this.alarms.trigger(alarmCode, source);
  }

  acknowledge(alarmCode: string): void {
    this.alarms.acknowledge(alarmCode);
  }

  clear(alarmCode: string): boolean {
    return this.alarms.clear(alarmCode);
  }

  /** Clears every fault and network override; all stations return to nominal. */
  reset(): void {
    const cleared = this.alarms.clearAll();
    this.network.reset();
    this.log.add('RESET', `All faults reset (${cleared} alarm(s) cleared)`);
  }

  setAutoCycle(enabled: boolean): void {
    if (enabled === this.autoCycle) return;
    this.autoCycle = enabled;
    this.log.add('AUTO_CYCLE', `Auto-cycle simulation ${enabled ? 'enabled' : 'paused'}`);
  }

  setNodeStatus(nodeId: string, status: NodeStatus): void {
    this.network.setStatus(nodeId, status);
    this.log.add('NETWORK', `${nodeId} link forced to ${status}`);
  }

  /** Loads the built-in matrix again. Returns the codes of the alarms that were cleared. */
  restoreDefaultRules(): string[] {
    const cleared = this.alarms.replaceRules(this.defaultRules);
    this.matrixRevision += 1;
    this.matrixSource = DEFAULT_MATRIX_SOURCE;
    this.log.add(
      'MATRIX',
      `Matrix loaded from ${DEFAULT_MATRIX_SOURCE}: ${this.defaultRules.length} rule(s)`,
    );
    return cleared;
  }

  // ------------------------------------------------------------- simulation

  /** One step of the background loop: telemetry, and a simulated event every N ticks. */
  step(): void {
    this.ticks += 1;
    this.network.tick(this.autoCycle);
    this.production.tick(this.alarms.lineStopped());
    if (this.autoCycle && this.ticks % AUTO_EVENT_EVERY_TICKS === 0) {
      this.alarms.autoStep(this.random);
    }
    this.publish();
  }

  start(): void {
    if (this.timer === undefined) this.timer = setInterval(() => this.step(), TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  // ---------------------------------------------------------------- fan-out

  snapshot(): PlantSnapshot {
    const active = this.alarms.active();
    return {
      facility: this.dataset.facility,
      simulated: true,
      sequence: this.sequence,
      timestamp: this.log.now(),
      auto_cycle: this.autoCycle,
      stations: buildStationStates(this.stations, active),
      active_alarms: active,
      network_nodes: this.network.states(),
      kpis: this.production.kpis(active, this.network.latencyOf(this.dataset.gateway_node_id)),
      event_log: this.log.entries(),
      alarm_history: this.alarms.history(),
      matrix_revision: this.matrixRevision,
      matrix_source: this.matrixSource,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Sends the current state to every subscriber, like one SSE event. */
  publish(): PlantSnapshot {
    this.sequence += 1;
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }
}
