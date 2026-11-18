import { LayoutDashboard, Network, TableProperties, type LucideIcon } from 'lucide-react';
import type { ViewId } from '../../types/telemetry';

// `short` is shown on phone-width screens, where the full labels do not fit side by side.
const TABS: { id: ViewId; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'live', label: 'Live Operations', short: 'Live', icon: LayoutDashboard },
  { id: 'matrix', label: 'Cause & Effect Matrix', short: 'Matrix', icon: TableProperties },
  { id: 'network', label: 'Network Watchdog', short: 'Network', icon: Network },
];

interface Props {
  view: ViewId;
  onChange: (view: ViewId) => void;
}

export function ViewTabs({ view, onChange }: Props) {
  return (
    <nav aria-label="Views" className="grid grid-cols-3 gap-1 sm:flex">
      {TABS.map(({ id, label, short, icon: Icon }) => {
        const active = id === view;
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-md border px-2 py-1.5 sm:shrink-0 sm:justify-start sm:px-3 text-sm font-medium transition-colors ${
              active
                ? 'border-link/60 bg-link/10 text-link'
                : 'border-transparent text-slate-400 hover:bg-panel hover:text-slate-200'
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
