import type { CauseEffectRule } from '../types/telemetry';

// Same matching rule as the backend (app/simulation/views.py).
const searchKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Every suffix of a field that starts on a word boundary, punctuation removed.
 * "SCP-01" gives ["scp01", "01"]. A token matches when a candidate starts with
 * it, so "cp-01" finds CP-01 but not SCP-01, while "jb-5" still finds JB-512.
 */
function fieldCandidates(value: string): string[] {
  const words = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.map((_, index) => words.slice(index).join(''));
}

export function filterRules(
  rules: CauseEffectRule[],
  query: string,
  stationId: string | null,
): CauseEffectRule[] {
  const tokens = query.split(/\s+/).map(searchKey).filter(Boolean);
  return rules.filter((rule) => {
    if (stationId && rule.station_id !== stationId) return false;
    const candidates = Object.values(rule).flatMap((value) => fieldCandidates(String(value)));
    return tokens.every((token) => candidates.some((candidate) => candidate.startsWith(token)));
  });
}
