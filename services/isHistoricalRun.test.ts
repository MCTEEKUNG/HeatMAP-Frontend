import { describe, it, expect } from 'vitest';
import { isHistoricalRun, hasVerificationMetrics, pendingWeeksRemaining } from './forecastService';

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

describe('verification helpers', () => {
  it('hasVerificationMetrics returns false for pending-only payloads', () => {
    expect(hasVerificationMetrics({ status: 'building', pending: { days_remaining: 10 } })).toBe(false);
  });

  it('hasVerificationMetrics returns true when BSS exists', () => {
    expect(hasVerificationMetrics({ bss: 0.12 })).toBe(true);
  });

  it('pendingWeeksRemaining rounds days up to weeks', () => {
    expect(pendingWeeksRemaining({ days_remaining: 10 })).toBe(2);
  });
});
