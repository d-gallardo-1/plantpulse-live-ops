import { STATUS_META, TONE_CLASSES } from '../../lib/statusMeta';
import type { NetworkNodeState, NodeStatus } from '../../types/telemetry';
import { StatusBadge } from '../shared/StatusBadge';
import { Sparkline } from './Sparkline';

const STROKE: Record<NodeStatus, string> = {
  ONLINE: 'stroke-link',
  DEGRADED: 'stroke-warn',
  OFFLINE: 'stroke-critical',
};

const OVERRIDES: { status: NodeStatus; label: string }[] = [
  { status: 'DEGRADED', label: 'Degrade link' },
  { status: 'OFFLINE', label: 'Drop link' },
  { status: 'ONLINE', label: 'Restore' },
];

interface Props {
  node: NetworkNodeState;
  history: (number | null)[];
  pending: boolean;
  onOverride: (nodeId: string, status: NodeStatus) => void;
}

export function NodeCard({ node, history, pending, onOverride }: Props) {
  const tone = TONE_CLASSES[STATUS_META[node.status].tone];

  return (
    <article
      aria-label={`${node.node_id} ${node.status}`}
      className={`panel flex flex-col gap-2 p-3 ${node.status === 'ONLINE' ? '' : tone.border} ${
        node.status === 'OFFLINE' ? 'shadow-glow-critical' : ''
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-mono text-sm font-semibold text-slate-50">{node.node_id}</h3>
          <p className="text-xs text-slate-400">{node.description}</p>
        </div>
        <StatusBadge status={node.status} compact />
      </header>

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">IP address</dt>
          <dd className="font-mono text-slate-100">{node.ip_address}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Latency</dt>
          <dd className={`font-mono ${node.latency_ms === null ? 'text-red-400' : 'text-slate-100'}`}>
            {node.latency_ms === null ? 'timeout' : `${node.latency_ms.toFixed(1)} ms`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Packet loss</dt>
          <dd className={`font-mono ${node.packet_loss_pct >= 1 ? tone.text : 'text-slate-100'}`}>
            {node.packet_loss_pct.toFixed(1)} %
          </dd>
        </div>
      </dl>

      <Sparkline values={history} className={STROKE[node.status]} />

      <footer className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-[11px] uppercase tracking-wider text-slate-400">
          {node.kind}
          {node.forced ? ' · forced by demo' : ''}
        </span>
        {OVERRIDES.filter((item) => item.status !== node.status).map((item) => (
          <button
            key={item.status}
            type="button"
            className="btn px-2 py-1 text-xs"
            disabled={pending}
            onClick={() => onOverride(node.node_id, item.status)}
          >
            {item.label}
          </button>
        ))}
      </footer>
    </article>
  );
}
