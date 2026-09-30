// How the weekly corpus check spaces its requests: a gap between two requests to the same host, and no more requests
// to a host that has already failed after retrying. Pure; the clock and the record of past requests are passed in.

/** When each host was last asked, and the gap to leave before asking it again. */
export type HostPace = {
  readonly lastRequestAt_ms: ReadonlyMap<string, number>;
  readonly gap_ms: number;
};

/** The host a request goes to; a Wayback URL goes to web.archive.org whatever it archives. */
export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** How long to wait before asking host at now_ms. Capped at the gap, so a clock that went back cannot stall the run. */
export const paceWait_ms = (pace: HostPace, host: string, now_ms: number): number => {
  const last_ms = pace.lastRequestAt_ms.get(host);
  if (last_ms === undefined) return 0;
  return Math.min(pace.gap_ms, Math.max(0, last_ms + pace.gap_ms - now_ms));
};

/**
 * Whether a host on which failedDocs documents have already failed after every retry is taken to be down for this run.
 * Its later documents are then reported as failed without a request: even a single attempt at a host that accepts
 * connections but never answers costs the whole request timeout, and enough of those outlast the job before the
 * report is written.
 */
export const isHostGivenUp = (failedDocs: number, giveUpAfter: number): boolean => failedDocs >= giveUpAfter;
