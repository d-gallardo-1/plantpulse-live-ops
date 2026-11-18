import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAlarm } from '../../test/fixtures';
import { AlarmCard } from './AlarmCard';

afterEach(cleanup);

const noPending: ReadonlySet<string> = new Set();

describe('AlarmCard', () => {
  it('shows an unacknowledged alarm with its trace and an Acknowledge button', () => {
    const onAcknowledge = vi.fn();
    render(<AlarmCard alarm={makeAlarm()} pending={noPending} onAcknowledge={onAcknowledge} onClear={vi.fn()} />);

    expect(screen.getByText('UNACKNOWLEDGED')).toBeTruthy();
    expect(screen.getAllByText('ZS-309').length).toBeGreaterThan(0);
    expect(screen.getByText('R2.S2.DI07')).toBeTruthy();
    expect(screen.getByText('CP-03 / JB-309')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(onAcknowledge).toHaveBeenCalledWith('ALM-207');
  });

  it('replaces the Acknowledge button with the acknowledgement time once acknowledged', () => {
    const alarm = makeAlarm({ acknowledged_at: '2026-11-18T10:00:05Z' });
    render(<AlarmCard alarm={alarm} pending={noPending} onAcknowledge={vi.fn()} onClear={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(screen.queryByText('UNACKNOWLEDGED')).toBeNull();
    expect(screen.getByText(/^ACKNOWLEDGED \d{2}:\d{2}:\d{2}$/)).toBeTruthy();
  });

  it('keeps Clear available in both states and reports the alarm code', () => {
    const onClear = vi.fn();
    const alarm = makeAlarm({ acknowledged_at: '2026-11-18T10:00:05Z' });
    render(<AlarmCard alarm={alarm} pending={noPending} onAcknowledge={vi.fn()} onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear ALM-207' }));
    expect(onClear).toHaveBeenCalledWith('ALM-207');
  });

  it('disables a button while its own command is in flight', () => {
    const pending: ReadonlySet<string> = new Set(['ack-ALM-207']);
    render(<AlarmCard alarm={makeAlarm()} pending={pending} onAcknowledge={vi.fn()} onClear={vi.fn()} />);

    expect((screen.getByRole('button', { name: 'Acknowledge' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Clear ALM-207' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
