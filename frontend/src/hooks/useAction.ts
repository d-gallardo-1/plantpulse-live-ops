import { useCallback, useState } from 'react';

/**
 * Runs API commands while tracking which ones are in flight and the last error.
 * Several commands can be pending at once, so each is tracked by its own key.
 * The resulting state change arrives through the SSE stream, so callers do not
 * need the response body.
 */
export function useAction() {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (key: string, action: () => Promise<unknown>) => {
    setPending((current) => new Set(current).add(key));
    try {
      await action();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  return { pending, error, run };
}
