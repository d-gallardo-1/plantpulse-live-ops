import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../test/fakeEventSource';
import { makeSnapshot } from '../test/fixtures';
import { RETRY_MS, STALE_MS, usePlantStream } from './usePlantStream';

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

describe('stream timing', () => {
  it('waits longer than the backend heartbeat before calling a connection dead', () => {
    // The backend sends something at least every 5 s (heartbeat_seconds in sse.py).
    expect(STALE_MS).toBe(8000);
    expect(STALE_MS).toBeGreaterThan(5000);
    expect(RETRY_MS).toBe(3000);
  });
});

describe('usePlantStream', () => {
  it('starts reconnecting with no snapshot and subscribes to the stream endpoint', () => {
    const { result } = renderHook(() => usePlantStream());

    expect(result.current).toEqual({ snapshot: null, status: 'RECONNECTING' });
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.latest.url).toBe('/api/v1/stream');
  });

  it('exposes the latest snapshot and reports the connection as live', () => {
    const { result } = renderHook(() => usePlantStream());

    act(() => FakeEventSource.latest.emit('snapshot', makeSnapshot({ sequence: 1 })));
    act(() => FakeEventSource.latest.emit('update', makeSnapshot({ sequence: 2 })));

    expect(result.current.status).toBe('CONNECTED');
    expect(result.current.snapshot?.sequence).toBe(2);
  });

  it('treats silence as a dead connection and rebuilds it', () => {
    const { result } = renderHook(() => usePlantStream());
    const first = FakeEventSource.latest;
    act(() => first.emit('snapshot', makeSnapshot()));

    advance(STALE_MS);

    expect(result.current.status).toBe('RECONNECTING');
    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(result.current.snapshot).not.toBeNull(); // last known data stays on screen

    advance(RETRY_MS);
    expect(FakeEventSource.instances).toHaveLength(2);

    act(() => FakeEventSource.latest.emit('snapshot', makeSnapshot({ sequence: 9 })));
    expect(result.current.status).toBe('CONNECTED');
    expect(result.current.snapshot?.sequence).toBe(9);
  });

  it('stays connected while heartbeats arrive, even without updates', () => {
    const { result } = renderHook(() => usePlantStream());
    act(() => FakeEventSource.latest.emit('snapshot', makeSnapshot()));

    for (let i = 0; i < 5; i += 1) {
      advance(STALE_MS - 1000);
      act(() => FakeEventSource.latest.emit('heartbeat'));
    }

    expect(result.current.status).toBe('CONNECTED');
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('reports DISCONNECTED after repeated failures and keeps retrying until it recovers', () => {
    const { result } = renderHook(() => usePlantStream());

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      act(() => FakeEventSource.latest.fail(true)); // HTTP error: the browser gives up
      expect(result.current.status).toBe(attempt < 3 ? 'RECONNECTING' : 'DISCONNECTED');
      advance(RETRY_MS);
      expect(FakeEventSource.instances).toHaveLength(attempt + 1);
    }

    act(() => FakeEventSource.latest.open());
    expect(result.current.status).toBe('CONNECTED');
  });

  it('does not open a second connection while the browser is reconnecting by itself', () => {
    renderHook(() => usePlantStream());

    act(() => FakeEventSource.latest.fail(false)); // network blip: the browser retries
    advance(RETRY_MS);

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('closes the stream and stops all timers on unmount', () => {
    const { unmount } = renderHook(() => usePlantStream());
    const source = FakeEventSource.latest;
    act(() => source.emit('snapshot', makeSnapshot()));

    unmount();
    advance(STALE_MS + RETRY_MS * 2);

    expect(source.readyState).toBe(FakeEventSource.CLOSED);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
