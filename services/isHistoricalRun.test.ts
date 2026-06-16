import { describe, it, expect } from 'vitest';
import { isHistoricalRun } from './forecastService';

describe('isHistoricalRun', () => {
  it('true when issue_date is much older than generated_at', () => {
    expect(isHistoricalRun('2023-12-31', '2026-06-16T00:00:00Z')).toBe(true);
  });
  it('false when issue_date is fresh (within 14 days)', () => {
    expect(isHistoricalRun('2026-06-10', '2026-06-16T00:00:00Z')).toBe(false);
  });
  it('false when issueDate missing', () => {
    expect(isHistoricalRun(undefined, '2026-06-16T00:00:00Z')).toBe(false);
  });
});
