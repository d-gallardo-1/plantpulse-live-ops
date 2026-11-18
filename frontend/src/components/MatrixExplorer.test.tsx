import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRule } from '../test/fixtures';
import type { CauseEffectRule, StationState } from '../types/telemetry';
import { MatrixExplorer } from './MatrixExplorer';

afterEach(cleanup);

const stations: StationState[] = ['STN-02', 'STN-03'].map((id, index) => ({
  station_id: id,
  name: `Station ${id}`,
  sequence: index + 1,
  description: '',
  status: 'NOMINAL',
  active_alarm_codes: [],
}));

const rules: CauseEffectRule[] = [
  makeRule({ alarm_code: 'ALM-203', station_id: 'STN-02', title: 'Guard Gate Open', cabinet: 'SCP-01' }),
  makeRule(), // ALM-207 at STN-03, cabinet CP-03
];

function renderExplorer(overrides: { rules?: CauseEffectRule[]; loadError?: string | null } = {}) {
  render(
    <MatrixExplorer
      rules={overrides.rules ?? rules}
      stations={stations}
      activeCodes={new Set()}
      matrixSource="Built-in sample matrix"
      loadError={overrides.loadError ?? null}
    />,
  );
}

const cards = () => screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'));

describe('MatrixExplorer', () => {
  it('lists every rule and narrows the list as the user types', () => {
    renderExplorer();
    expect(cards()).toHaveLength(2);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'scp-01' } });

    expect(cards()).toEqual(['ALM-203 Guard Gate Open']);
    expect(screen.getByText('1 of 2 rules')).toBeTruthy();
  });

  it('filters by station', () => {
    renderExplorer();

    fireEvent.click(screen.getByRole('button', { name: 'STN-03' }));

    expect(cards()).toEqual(['ALM-207 Hopper Discharge Gate Failed to Close']);
  });

  it('says so when nothing matches the search', () => {
    renderExplorer();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-such-tag' } });

    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByText(/No rule matches that search/)).toBeTruthy();
  });

  it('shows no warning while the matrix loads normally', () => {
    renderExplorer({ rules: [] });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Loading the matrix from the backend/)).toBeTruthy();
  });

  it('explains a failed first load instead of showing an endless loading message', () => {
    renderExplorer({ rules: [], loadError: 'HTTP 500' });

    const alert = screen.getByRole('alert').textContent ?? '';
    expect(alert).toContain('Could not load the matrix from the backend (HTTP 500)');
    expect(alert).not.toContain('last ones loaded');
    expect(screen.getByText('No matrix is available yet.')).toBeTruthy();
    expect(screen.queryByText(/Loading the matrix/)).toBeNull();
  });

  it('keeps the previous rules visible and marks them as possibly outdated when a reload fails', () => {
    renderExplorer({ loadError: 'HTTP 503' });

    expect(screen.getByRole('alert').textContent).toContain('may be out of date');
    expect(cards()).toHaveLength(2);
  });
});
