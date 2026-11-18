import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../test/fakeEventSource';
import { makeSnapshot } from '../test/fixtures';
import { usePlantStream } from './usePlantStream';

const STALE_MS = 8000;
const RETRY_MS = 3000;

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('usePlantStream recovery', () => {
  it('gives up on a connection that is accepted but never sends anything', () => {
    // No open, no error, no data: a proxy that took the connection and went quiet.
    const { result } = renderHook(() => usePlantStream());

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      advance(STALE_MS);
      expect(result.current.status).toBe(cycle < 3 ? 'RECONNECTING' : 'DISCONNECTED');
      advance(RETRY_MS);
      expect(FakeEventSource.instances).toHaveLength(cycle + 1);
    }

    // It keeps rebuilding the connection for as long as the outage lasts.
    advance((STALE_MS + RETRY_MS) * 5);
    expect(FakeEventSource.instances).toHaveLength(9);
    expect(result.current.status).toBe('DISCONNECTED');
  });

  it('counts one outage once, even when an error and the silence timer overlap', () => {
    const { result } = renderHook(() => usePlantStream());
    act(() => FakeEventSource.latest.emit('snapshot', makeSnapshot()));

    advance(STALE_MS - 100);
    act(() => FakeEventSource.latest.fail(true)); // first failure, retry scheduled
    advance(200); // the old silence timer would have fired here

    expect(result.current.status).toBe('RECONNECTING');
    advance(RETRY_MS);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('forgets earlier failures once the stream is healthy again', () => {
    const { result } = renderHook(() => usePlantStream());
    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => FakeEventSource.latest.fail(true));
      advance(RETRY_MS);
    }
    expect(result.current.status).toBe('DISCONNECTED');

    act(() => FakeEventSource.latest.emit('snapshot', makeSnapshot()));
    expect(result.current.status).toBe('CONNECTED');

    // A single blip after recovery is a reconnect, not a full disconnection.
    act(() => FakeEventSource.latest.fail(false));
    expect(result.current.status).toBe('RECONNECTING');
  });

  it('gives a browser-driven reconnect a full window before rebuilding', () => {
    renderHook(() => usePlantStream());
    act(() => FakeEventSource.latest.emit('snapshot', makeSnapshot()));

    advance(STALE_MS - 100);
    act(() => FakeEventSource.latest.fail(false)); // the browser retries by itself
    advance(STALE_MS - 100);
    expect(FakeEventSource.instances).toHaveLength(1);

    advance(100 + RETRY_MS);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('does not reconnect after unmounting during the retry window', () => {
    const { unmount } = renderHook(() => usePlantStream());
    act(() => FakeEventSource.latest.fail(true)); // retry pending

    unmount();
    advance(RETRY_MS + STALE_MS * 2);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
