const GITHUB_PAGES_RE = /^https:\/\/([^.]+)\.github\.io\/([^/]+)\/(.+)$/i;

export function contractCandidateUrls(primaryUrl: string): string[] {
  const urls = [primaryUrl];
  const m = primaryUrl.match(GITHUB_PAGES_RE);
  if (!m) return urls;
  const [, owner, repo, assetPath] = m;
  urls.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/${assetPath}`);
  return urls;
}

export async function fetchJsonWithFallback<T>(primaryUrl: string): Promise<T> {
  let lastError: Error | null = null;
  for (const url of contractCandidateUrls(primaryUrl)) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`fetch failed (${res.status}) for ${url}`);
        continue;
      }
      return await res.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`fetch failed for ${primaryUrl}`);
}
