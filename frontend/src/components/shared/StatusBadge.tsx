import { STATUS_META, TONE_CLASSES, type AnyStatus } from '../../lib/statusMeta';

interface Props {
  status: AnyStatus;
  compact?: boolean;
}

/** Colour + icon + text label, so status never depends on colour alone. */
export function StatusBadge({ status, compact = false }: Props) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  const Icon = meta.icon;
  const pulse = status === 'CRITICAL' ? 'motion-safe:animate-pulse' : '';
  const size = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-mono font-semibold tracking-wide ${size} ${tone.text} ${tone.border} ${tone.bg}`}
    >
      <Icon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${pulse}`} />
      {meta.label}
    </span>
  );
}
