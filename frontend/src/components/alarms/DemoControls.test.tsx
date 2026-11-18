import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { makeRule } from '../../test/fixtures';
import type { CauseEffectRule } from '../../types/telemetry';
import { DemoControls, demoFaults } from './DemoControls';

afterEach(cleanup);

const builtIn: CauseEffectRule[] = [
  makeRule({ alarm_code: 'ALM-201', title: 'Release Agent Tank Low Level' }),
  makeRule({ alarm_code: 'ALM-203', title: 'Guard Gate Open During Manipulator Cycle' }),
  makeRule({ alarm_code: 'ALM-207', title: 'Hopper Discharge Gate Failed to Close' }),
];

function renderControls(rules: CauseEffectRule[], activeCodes: string[] = [], autoCycle = false) {
  const run = vi.fn((_key: string, action: () => Promise<unknown>) => void action());
  render(
    <DemoControls
      autoCycle={autoCycle}
      rules={rules}
      activeCodes={new Set(activeCodes)}
      pending={new Set()}
      error={null}
      run={run}
    />,
  );
  return run;
}

describe('demoFaults', () => {
  it('offers the preferred alarms that exist, labelled with the title in the loaded matrix', () => {
    expect(demoFaults(builtIn)).toEqual([
      { code: 'ALM-203', hint: 'Guard Gate Open During Manipulator Cycle' },
      { code: 'ALM-207', hint: 'Hopper Discharge Gate Failed to Close' },
    ]);
  });

  it('reflects a title edited in an uploaded matrix', () => {
    const edited = builtIn.map((rule) =>
      rule.alarm_code === 'ALM-207' ? { ...rule, title: 'Gate Jammed (edited)' } : rule,
    );

    expect(demoFaults(edited).find((fault) => fault.code === 'ALM-207')?.hint).toBe(
      'Gate Jammed (edited)',
    );
  });

  it('falls back to the first rules when no preferred alarm exists', () => {
    const custom = ['ALM-901', 'ALM-902', 'ALM-903', 'ALM-904', 'ALM-905'].map((code) =>
      makeRule({ alarm_code: code, title: `Custom ${code}` }),
    );

    expect(demoFaults(custom).map((fault) => fault.code)).toEqual([
      'ALM-901',
      'ALM-902',
      'ALM-903',
      'ALM-904',
    ]);
    expect(demoFaults([])).toEqual([]);
  });
});

describe('DemoControls', () => {
  it('triggers the alarm named on the button', () => {
    const trigger = vi.spyOn(api, 'trigger').mockResolvedValue({});
    renderControls(builtIn);

    fireEvent.click(screen.getByRole('button', { name: /Trigger ALM-207/ }));

    expect(trigger).toHaveBeenCalledWith('ALM-207');
  });

  it('disables the button of an alarm that is already active', () => {
    renderControls(builtIn, ['ALM-207']);

    const active = screen.getByRole('button', { name: /Active: ALM-207/ }) as HTMLButtonElement;
    const idle = screen.getByRole('button', { name: /Trigger ALM-203/ }) as HTMLButtonElement;
    expect(active.disabled).toBe(true);
    expect(idle.disabled).toBe(false);
  });

  it('toggles auto-cycle to the opposite of its current state', () => {
    const setAutoCycle = vi.spyOn(api, 'setAutoCycle').mockResolvedValue({});
    renderControls(builtIn, [], true);

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);

    expect(setAutoCycle).toHaveBeenCalledWith(false);
  });
});
