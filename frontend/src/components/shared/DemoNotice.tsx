import { Info } from 'lucide-react';
import { REPOSITORY_URL } from '../../lib/demoMode';

/** Shown only in the browser demo build: says what is different from the full project. */
export function DemoNotice() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-link/40 bg-link/10 px-3 py-2 text-sm text-slate-200">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-link" />
      <span>
        Browser demo. The plant simulation runs inside this page, so what you do here stays on your
        device. The full project streams the same data from a FastAPI backend over Server-Sent
        Events:{' '}
        <a className="text-link underline" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          source on GitHub
        </a>
        .
      </span>
    </p>
  );
}
