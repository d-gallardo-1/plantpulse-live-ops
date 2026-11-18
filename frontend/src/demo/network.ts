import type { NetworkNodeState, NodeStatus } from '../types/telemetry';
import type { NodeDefinition } from './dataset';
import { roundTo1, uniform, type Random } from './eventLog';

/** Chance per tick that a healthy node shows a short degradation (auto-cycle only). */
const BLIP_PROBABILITY = 0.02;

interface Reading {
  latency: number | null;
  loss: number;
}

/** Simulated ping and packet-loss telemetry. Mirrors simulation/network.py. */
export class NetworkSimulator {
  private forced = new Map<string, NodeStatus>();
  private blipTicks = new Map<string, number>();
  private live = new Map<string, Reading>();

  constructor(private readonly nodes: NodeDefinition[], private readonly random: Random) {
    this.refresh();
  }

  /** Forces a node into a status until it is set back to ONLINE or reset. */
  setStatus(nodeId: string, status: NodeStatus): void {
    if (!this.nodes.some((node) => node.node_id === nodeId)) {
      throw new Error(`Unknown network node: ${nodeId}`);
    }
    if (status === 'ONLINE') this.forced.delete(nodeId);
    else this.forced.set(nodeId, status);
    this.blipTicks.delete(nodeId);
    this.refresh();
  }

  reset(): void {
    this.forced.clear();
    this.blipTicks.clear();
    this.refresh();
  }

  tick(allowBlips: boolean): void {
    if (allowBlips) {
      for (const node of this.nodes) {
        const healthy = !this.forced.has(node.node_id) && !this.blipTicks.has(node.node_id);
        if (healthy && this.random() < BLIP_PROBABILITY) {
          this.blipTicks.set(node.node_id, 2 + Math.min(2, Math.floor(this.random() * 3)));
        }
      }
    }
    this.refresh();
    for (const [nodeId, ticks] of [...this.blipTicks]) {
      if (ticks <= 1) this.blipTicks.delete(nodeId);
      else this.blipTicks.set(nodeId, ticks - 1);
    }
  }

  statusOf(nodeId: string): NodeStatus {
    return this.forced.get(nodeId) ?? (this.blipTicks.has(nodeId) ? 'DEGRADED' : 'ONLINE');
  }

  latencyOf(nodeId: string): number | null {
    return this.live.get(nodeId)?.latency ?? null;
  }

  states(): NetworkNodeState[] {
    return this.nodes.map((node) => ({
      node_id: node.node_id,
      description: node.description,
      kind: node.kind,
      ip_address: node.ip_address,
      status: this.statusOf(node.node_id),
      latency_ms: this.latencyOf(node.node_id),
      packet_loss_pct: this.live.get(node.node_id)?.loss ?? 0,
      forced: this.forced.has(node.node_id),
    }));
  }

  /** Draws new latency and packet-loss readings for every node. */
  private refresh(): void {
    for (const node of this.nodes) {
      const status = this.statusOf(node.node_id);
      if (status === 'OFFLINE') {
        this.live.set(node.node_id, { latency: null, loss: 100 });
      } else if (status === 'DEGRADED') {
        const latency = node.baseline_latency_ms * uniform(this.random, 6, 14);
        const loss = uniform(this.random, 3, 12);
        this.live.set(node.node_id, { latency: roundTo1(latency), loss: roundTo1(loss) });
      } else {
        const latency = node.baseline_latency_ms * uniform(this.random, 0.85, 1.25);
        const loss = this.random() < 0.9 ? 0 : uniform(this.random, 0.1, 0.4);
        this.live.set(node.node_id, { latency: roundTo1(latency), loss: roundTo1(loss) });
      }
    }
  }
}
