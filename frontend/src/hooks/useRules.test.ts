import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { makeRule } from '../test/fixtures';
import type { StreamStatus } from '../types/telemetry';
import { RULES_RETRY_MS, useRules } from './useRules';

const response = (title: string) => ({
  query: '',
  station_id: null,
  count: 1,
  rules: [makeRule({ title })],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets resolved promises and the given amount of timer time run. */
const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

function render(status: StreamStatus, revision: number | null) {
  return renderHook(({ s, r }) => useRules(s, r), { initialProps: { s: status, r: revision } });
}

describe('useRules', () => {
  it('waits for a connected stream and a known revision before loading', async () => {
    const matrix = vi.spyOn(api, 'matrix').mockResolvedValue(response('First'));
    const { result, rerender } = render('RECONNECTING', null);

    await settle();
    rerender({ s: 'CONNECTED', r: null });
    await settle();
    expect(matrix).not.toHaveBeenCalled();

    rerender({ s: 'CONNECTED', r: 0 });
    await settle();
    expect(matrix).toHaveBeenCalledTimes(1);
    expect(result.current.map((rule) => rule.title)).toEqual(['First']);
  });

  it('loads once per revision and reloads when the matrix is replaced', async () => {
    const matrix = vi
      .spyOn(api, 'matrix')
      .mockResolvedValueOnce(response('Built-in'))
      .mockResolvedValueOnce(response('Uploaded'));
    const { result, rerender } = render('CONNECTED', 0);
    await settle();

    rerender({ s: 'CONNECTED', r: 0 }); // same revision: nothing to do
    await settle(RULES_RETRY_MS * 3);
    expect(matrix).toHaveBeenCalledTimes(1);

    rerender({ s: 'CONNECTED', r: 1 });
    await settle();
    expect(matrix).toHaveBeenCalledTimes(2);
    expect(result.current.map((rule) => rule.title)).toEqual(['Uploaded']);
  });

  it('retries a failed load while the stream stays connected', async () => {
    const matrix = vi
      .spyOn(api, 'matrix')
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce(response('Recovered'));
    const { result } = render('CONNECTED', 0);

    await settle();
    expect(result.current).toEqual([]);

    await settle(RULES_RETRY_MS);
    expect(matrix).toHaveBeenCalledTimes(2);
    await settle(RULES_RETRY_MS);
    expect(matrix).toHaveBeenCalledTimes(3);
    expect(result.current.map((rule) => rule.title)).toEqual(['Recovered']);

    await settle(RULES_RETRY_MS * 3); // loaded: no further requests
    expect(matrix).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after unmount', async () => {
    const matrix = vi.spyOn(api, 'matrix').mockRejectedValue(new Error('HTTP 500'));
    const { unmount } = render('CONNECTED', 0);
    await settle();

    unmount();
    await settle(RULES_RETRY_MS * 3);

    expect(matrix).toHaveBeenCalledTimes(1);
  });
});
