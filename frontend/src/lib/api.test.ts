import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, formatTime } from './api';

function mockFetch(status: number, body: unknown, json = true) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: json ? async () => body : async () => Promise.reject(new Error('not json')),
  };
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('posts fault commands to the simulation endpoints', async () => {
    const fetchMock = mockFetch(200, {});

    await api.trigger('ALM-207');
    await api.acknowledge('ALM-207');
    await api.setAutoCycle(false);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/simulate/trigger/ALM-207',
      '/api/v1/alarms/ALM-207/acknowledge',
      '/api/v1/simulate/auto-cycle',
    ]);
    const [, init] = fetchMock.mock.calls[2];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ enabled: false }));
  });

  it('surfaces the explanation the server sends with a rejection', async () => {
    mockFetch(422, { detail: 'Unknown station ID(s): STN-99.' });

    await expect(api.restoreMatrix()).rejects.toThrow('Unknown station ID(s): STN-99.');
  });

  it('falls back to a generic message when the error body is not usable', async () => {
    mockFetch(502, null, false);
    await expect(api.reset()).rejects.toThrow('POST /simulate/reset failed with HTTP 502');

    mockFetch(422, { detail: [{ msg: 'field required' }] });
    await expect(api.reset()).rejects.toThrow('POST /simulate/reset failed with HTTP 422');
  });

  it('uploads a workbook as the raw body with its name encoded in the query', async () => {
    const fetchMock = mockFetch(200, { source: 'x', revision: 1, rule_count: 12, alarms_cleared: [] });
    const file = new File(['PK'], 'my matrix v2.xlsx');

    const result = await api.uploadMatrix(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/matrix/upload?filename=my%20matrix%20v2.xlsx');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(file);
    expect(result.rule_count).toBe(12);
  });
});

describe('formatTime', () => {
  it('returns a placeholder for an invalid timestamp', () => {
    expect(formatTime('not a date')).toBe('--:--:--');
  });

  it('formats a valid timestamp as 24-hour time', () => {
    expect(formatTime('2026-11-18T10:05:42Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
