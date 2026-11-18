import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATASET } from './dataset';
import { demoApi, demoEngine, UPLOAD_UNAVAILABLE } from './demoApi';
import { TICK_MS } from './engine';
import { useDemoStream } from './useDemoStream';

const CODE = DATASET.rules[0].alarm_code;

beforeEach(() => {
  vi.useFakeTimers();
  // The page has one engine for its whole life. Each test gets its own fake
  // clock, so the engine's timer has to be created again on that clock.
  demoEngine().stop();
  demoEngine().start();
});
afterEach(async () => {
  await demoApi.reset();
  await demoApi.setAutoCycle(true);
  vi.useRealTimers();
});

describe('browser demo API and stream', () => {
  it('serves the built-in matrix', async () => {
    const response = await demoApi.matrix();

    expect(response.count).toBe(DATASET.rules.length);
    expect(response.rules[0].alarm_code).toBe(CODE);
  });

  it('delivers every command to the stream hook straight away', async () => {
    const { result } = renderHook(() => useDemoStream());
    expect(result.current.status).toBe('CONNECTED');
    expect(result.current.snapshot?.active_alarms).toEqual([]);

    await act(() => demoApi.trigger(CODE));
    expect(result.current.snapshot?.active_alarms.map((a) => a.rule.alarm_code)).toEqual([CODE]);

    await act(() => demoApi.acknowledge(CODE));
    expect(result.current.snapshot?.active_alarms[0].acknowledged_at).not.toBeNull();

    await act(() => demoApi.clear(CODE));
    expect(result.current.snapshot?.active_alarms).toEqual([]);
    expect(result.current.snapshot?.alarm_history[0].alarm_code).toBe(CODE);
  });

  it('keeps the telemetry moving on its own', async () => {
    await demoApi.setAutoCycle(false);
    const { result } = renderHook(() => useDemoStream());
    const first = result.current.snapshot!.sequence;

    await act(async () => void (await vi.advanceTimersByTimeAsync(TICK_MS * 3)));

    expect(result.current.snapshot!.sequence).toBe(first + 3);
  });

  it('stops delivering snapshots after unmount', async () => {
    const { result, unmount } = renderHook(() => useDemoStream());
    unmount();

    await demoApi.trigger(CODE);

    expect(result.current.snapshot?.active_alarms).toEqual([]);
    expect(demoEngine().snapshot().active_alarms).toHaveLength(1);
  });

  it('rejects failed commands with a readable reason', async () => {
    await expect(demoApi.trigger('ALM-999')).rejects.toThrow('Unknown alarm code: ALM-999');
    await expect(demoApi.uploadMatrix(new File([], 'matrix.xlsx'))).rejects.toThrow(UPLOAD_UNAVAILABLE);
  });

  it('restores the matrix and reports what it cleared', async () => {
    await demoApi.trigger(CODE);
    const before = demoEngine().snapshot().matrix_revision;

    const result = await demoApi.restoreMatrix();

    expect(result).toMatchObject({
      revision: before + 1,
      rule_count: DATASET.rules.length,
      alarms_cleared: [CODE],
    });
  });
});
