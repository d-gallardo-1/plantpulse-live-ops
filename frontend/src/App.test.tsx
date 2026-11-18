import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { usePlantStream } from './hooks/usePlantStream';
import { api } from './lib/api';
import { makeAlarm, makeRule, makeSnapshot } from './test/fixtures';
import type { StreamStatus } from './types/telemetry';

vi.mock('./hooks/usePlantStream', () => ({ usePlantStream: vi.fn() }));

afterEach(cleanup);

function renderApp(status: StreamStatus, withSnapshot = true) {
  vi.spyOn(api, 'matrix').mockResolvedValue({ query: '', station_id: null, count: 1, rules: [makeRule()] });
  const snapshot = withSnapshot ? makeSnapshot({ active_alarms: [makeAlarm()] }) : null;
  vi.mocked(usePlantStream).mockReturnValue({ snapshot, status });
  render(<App />);
}

const acknowledge = () => screen.getByRole('button', { name: 'Acknowledge' }) as HTMLButtonElement;

describe('App connection states', () => {
  it('shows no warning and leaves controls enabled while connected', () => {
    renderApp('CONNECTED');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(acknowledge().matches(':disabled')).toBe(false);
  });

  it('warns during a reconnect but keeps controls usable', () => {
    renderApp('RECONNECTING');

    expect(screen.getByRole('alert').textContent).toContain('Reconnecting to the live stream');
    // An operator must still be able to acknowledge an alarm during a short blip.
    expect(acknowledge().matches(':disabled')).toBe(false);
  });

  it('warns and disables every control once the connection is given up on', () => {
    renderApp('DISCONNECTED');

    expect(screen.getByRole('alert').textContent).toContain('controls are disabled');
    expect(acknowledge().matches(':disabled')).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear ALM-207' }) as HTMLButtonElement).matches(':disabled')).toBe(true);
    // Navigation between views lives outside the disabled area.
    expect((screen.getByRole('button', { name: /Network Watchdog/ }) as HTMLButtonElement).matches(':disabled')).toBe(false);
  });

  it('explains the situation when no snapshot has ever arrived', () => {
    renderApp('DISCONNECTED', false);

    expect(screen.getByText(/Cannot reach the backend/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
  });
});
