// Fetches a page as text, in the encoding it declares, with a timeout. A non-2xx answer throws an error whose cause
// carries the HTTP status, so a caller can tell a dead page (404) from a transient one (503). Every error names the URL.
import { decodeFetched } from "./fetched-text.ts";

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${String(status)}`);
    this.status = status;
  }
}

/** The page's text and the Content-Type it was sent with (null when it had none). */
export type FetchedPage = { readonly text: string; readonly contentType: string | null };

/** What fetches: the global fetch, or a stand-in in tests. */
export type Fetcher = (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>;

export const fetchPage = async (url: string, timeout_ms: number, fetcher: Fetcher = fetch): Promise<FetchedPage> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout_ms);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new HttpStatusError(response.status);
    const contentType = response.headers.get("content-type");
    return { text: decodeFetched(new Uint8Array(await response.arrayBuffer()), contentType), contentType };
  } catch (err) {
    throw new Error(`${url}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
};
