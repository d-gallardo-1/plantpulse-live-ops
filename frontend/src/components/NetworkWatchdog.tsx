import { useAction } from '../hooks/useAction';
import type { LatencyHistory } from '../hooks/useLatencyHistory';
import { api } from '../lib/api';
import type { NetworkNodeState, NodeStatus } from '../types/telemetry';
import { NodeCard } from './network/NodeCard';
import { StatusBadge } from './shared/StatusBadge';

const STATUSES: NodeStatus[] = ['ONLINE', 'DEGRADED', 'OFFLINE'];

interface Props {
  nodes: NetworkNodeState[];
  history: LatencyHistory;
}

/** Edge & Field Network Watchdog (orchestrator): node health and latency trends. */
export function NetworkWatchdog({ nodes, history }: Props) {
  const { pending, error, run } = useAction();

  return (
    <section aria-labelledby="network-title" className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <h2 id="network-title" className="panel-title">
          Edge &amp; Field Network Watchdog
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {STATUSES.map((status) => (
            <span key={status} className="flex items-center gap-1.5 font-mono text-sm text-slate-200">
              {nodes.filter((node) => node.status === status).length}
              <StatusBadge status={status} compact />
            </span>
          ))}
        </div>
        <p className="w-full text-xs text-slate-400">
          Simulated ping and packet-loss telemetry. Use the buttons on a node to force a link state;
          “Reset All Faults” on the Live Operations view restores every node.
        </p>
        {error && (
          <p role="alert" className="w-full rounded border border-critical/50 bg-critical/10 px-2 py-1.5 text-xs text-critical">
            Command failed: {error}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {nodes.map((node) => (
          <NodeCard
            key={node.node_id}
            node={node}
            history={history[node.node_id] ?? []}
            pending={pending.has(node.node_id)}
            onOverride={(nodeId, status) => run(nodeId, () => api.setNodeStatus(nodeId, status))}
          />
        ))}
      </div>
    </section>
  );
}
