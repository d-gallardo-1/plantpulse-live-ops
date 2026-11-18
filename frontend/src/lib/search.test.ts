import { describe, expect, it } from 'vitest';
import { makeRule } from '../test/fixtures';
import { filterRules } from './search';

// Every searchable field is set explicitly, so a match can only come from the
// field a test names (the shared fixture describes a hopper gate everywhere).
const rule = (
  alarm_code: string,
  station_id: string,
  title: string,
  device_tag: string,
  plc_input: string,
  cabinet: string,
  junction_box: string,
) =>
  makeRule({
    alarm_code,
    station_id,
    station_name: 'Station',
    title,
    device_tag,
    plc_input,
    cabinet,
    junction_box,
    root_cause: 'Cause.',
    trip_condition: 'Condition',
    device_description: 'Device',
    interlock_effect: 'Effect.',
    affected_output: 'OUT',
    affected_output_description: 'Output',
    recommended_action: 'Action.',
  });

const rules = [
  rule('ALM-201', 'STN-01', 'Release Agent Tank Low Level', 'LSL-112', 'R1.S2.DI04', 'CP-01', 'JB-110'),
  rule('ALM-203', 'STN-02', 'Guard Gate Open During Manipulator Cycle', 'GS-214', 'F-R1.S1.DI02', 'SCP-01', 'JB-214'),
  rule('ALM-207', 'STN-03', 'Hopper Discharge Gate Failed to Close', 'ZS-309', 'R2.S2.DI07', 'CP-03', 'JB-309'),
  rule('ALM-209', 'STN-05', 'Steam Valve Position Feedback Mismatch', 'ZT-512', 'R3.S2.AI04', 'CP-05', 'JB-512'),
];

const codes = (query: string, stationId: string | null = null) =>
  filterRules(rules, query, stationId).map((rule) => rule.alarm_code);

describe('filterRules', () => {
  it('returns every rule for an empty or blank query', () => {
    expect(codes('')).toHaveLength(4);
    expect(codes('   ')).toHaveLength(4);
  });

  it('ignores case and punctuation', () => {
    expect(codes('ALM-203')).toEqual(['ALM-203']);
    expect(codes('alm203')).toEqual(['ALM-203']);
    expect(codes('r2.s2.di07')).toEqual(['ALM-207']);
  });

  it('matches a tag from a word boundary, not from the middle of a longer tag', () => {
    // "cp01" is contained in "scp01", but SCP-01 is a different cabinet.
    expect(codes('CP-01')).toEqual(['ALM-201']);
    expect(codes('SCP-01')).toEqual(['ALM-203']);
  });

  it('matches a partial tag and an inner segment of a dotted address', () => {
    expect(codes('JB-5')).toEqual(['ALM-209']);
    expect(codes('di07')).toEqual(['ALM-207']);
  });

  it('requires every token to match', () => {
    expect(codes('hopper gate')).toEqual(['ALM-207']);
    expect(codes('hopper steam')).toEqual([]);
  });

  it('filters by station and combines the filter with the query', () => {
    expect(codes('', 'STN-03')).toEqual(['ALM-207']);
    expect(codes('gate', 'STN-02')).toEqual(['ALM-203']);
    expect(codes('gate', 'STN-05')).toEqual([]);
  });

  it('returns nothing for an unknown tag', () => {
    expect(codes('no-such-tag')).toEqual([]);
  });
});
