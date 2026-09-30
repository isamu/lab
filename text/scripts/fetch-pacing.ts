// How the weekly corpus check spaces its requests: a gap between two requests to the same host, and fewer retries
// for a host that has already failed after retrying. Pure; the clock and the record of past requests are passed in.

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
 * The retry waits for a host on which failedDocs documents have already failed after every retry. Once that reaches
 * giveUpAfter, the host is taken to be down for this run and later documents are tried once, so a dead host cannot
 * spend the job's time limit on waits and the report is still written.
 */
export const retryDelaysFor = (failedDocs: number, delays_ms: readonly number[], giveUpAfter: number): readonly number[] =>
  failedDocs >= giveUpAfter ? [] : delays_ms;
