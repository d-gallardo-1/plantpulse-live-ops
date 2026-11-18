const WIDTH = 120;
const HEIGHT = 28;

interface Props {
  /** Latency samples, oldest first. ``null`` means the node did not answer. */
  values: (number | null)[];
  className: string;
}

/** Tiny latency trend. Drawn with SVG attributes only (no inline styles). */
export function Sparkline({ values, className }: Props) {
  const numeric = values.filter((value): value is number => value !== null);
  if (numeric.length < 2) {
    return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-7 w-full" aria-hidden="true" />;
  }
  const max = Math.max(...numeric) * 1.1;
  const step = WIDTH / (values.length - 1);

  // A gap (null sample) splits the line into separate segments.
  const segments: string[][] = [[]];
  values.forEach((value, index) => {
    if (value === null) {
      if (segments[segments.length - 1].length > 0) segments.push([]);
      return;
    }
    const x = (index * step).toFixed(1);
    const y = (HEIGHT - 2 - (value / max) * (HEIGHT - 4)).toFixed(1);
    segments[segments.length - 1].push(`${x},${y}`);
  });

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      {segments
        .filter((points) => points.length > 1)
        .map((points) => (
          <polyline
            key={points[0]}
            points={points.join(' ')}
            fill="none"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className={className}
          />
        ))}
    </svg>
  );
}
