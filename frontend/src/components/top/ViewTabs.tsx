import { LayoutDashboard, Network, TableProperties, type LucideIcon } from 'lucide-react';
import type { ViewId } from '../../types/telemetry';

const TABS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: 'live', label: 'Live Operations', icon: LayoutDashboard },
  { id: 'matrix', label: 'Cause & Effect Matrix', icon: TableProperties },
  { id: 'network', label: 'Network Watchdog', icon: Network },
];

interface Props {
  view: ViewId;
  onChange: (view: ViewId) => void;
}

export function ViewTabs({ view, onChange }: Props) {
  return (
    <nav aria-label="Views" className="flex gap-1 overflow-x-auto">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = id === view;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'border-link/60 bg-link/10 text-link'
                : 'border-transparent text-slate-400 hover:bg-panel hover:text-slate-200'
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
