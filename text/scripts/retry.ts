// Retrying a fetch that failed for a reason that may pass: a timeout, a dropped connection, a 5xx, a 429. A 404 or
// any other 4xx is the source's answer and is not retried. The wait is injected, so this runs without a clock.
import { HttpStatusError } from "./fetch-text.ts";

/** One wait before each retry, growing: a source that is still down after these is counted as failed. */
export const RETRY_DELAYS_MS: readonly number[] = [5_000, 20_000];

const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_EARLY = 425;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
const TRANSIENT_CLIENT_STATUSES: ReadonlySet<number> = new Set([HTTP_REQUEST_TIMEOUT, HTTP_TOO_EARLY, HTTP_TOO_MANY_REQUESTS]);

const statusIn = (error: unknown): number | undefined => {
  if (error instanceof HttpStatusError) return error.status;
  return error instanceof Error && error.cause !== undefined ? statusIn(error.cause) : undefined;
};

/** An error with no HTTP status never got an answer (timeout, DNS, reset), so it may pass; with one, only 408/425/429/5xx may. */
export const isTransientFetchError = (error: unknown): boolean => {
  const status = statusIn(error);
  return status === undefined || status >= HTTP_SERVER_ERROR || TRANSIENT_CLIENT_STATUSES.has(status);
};

export type RetryOptions = {
  readonly delays_ms: readonly number[];
  readonly isTransient: (error: unknown) => boolean;
  readonly sleep: (ms: number) => Promise<void>;
  readonly onRetry?: (error: unknown, delay_ms: number) => void;
};

/** Runs attempt, and again after each delay while it keeps failing transiently; the last error is thrown. */
export const withRetry = async <T>(attempt: () => Promise<T>, options: RetryOptions): Promise<T> => {
  try {
    return await attempt();
  } catch (err) {
    const [delay_ms, ...rest] = options.delays_ms;
    if (delay_ms === undefined || !options.isTransient(err)) throw err;
    options.onRetry?.(err, delay_ms);
    await options.sleep(delay_ms);
    return withRetry(attempt, { ...options, delays_ms: rest });
  }
};
