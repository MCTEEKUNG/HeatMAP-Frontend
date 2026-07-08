import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractCandidateUrls, fetchJsonWithFallback } from './contractFetch';

describe('contract fetch fallbacks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds raw GitHub fallback for GitHub Pages contract URLs', () => {
    expect(contractCandidateUrls('https://mcteekung.github.io/heatwave-contract/forecast_provinces.json')).toEqual([
      'https://mcteekung.github.io/heatwave-contract/forecast_provinces.json',
      'https://raw.githubusercontent.com/mcteekung/heatwave-contract/main/forecast_provinces.json',
    ]);
  });

  it('keeps same-origin URLs unchanged', () => {
    expect(contractCandidateUrls('/forecast_provinces.json')).toEqual(['/forecast_provinces.json']);
  });

  it('falls back to raw GitHub when Pages returns 404', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'building' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchJsonWithFallback('https://mcteekung.github.io/heatwave-contract/verification.json'),
    ).resolves.toEqual({ status: 'building' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://mcteekung.github.io/heatwave-contract/verification.json');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://raw.githubusercontent.com/mcteekung/heatwave-contract/main/verification.json');
  });
});
