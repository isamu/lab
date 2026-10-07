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

export type FetchLimits = {
  readonly timeout_ms: number;
  /** A body longer than this is refused while it is read, before it is decoded. Undefined: no limit. */
  readonly max_bytes?: number | undefined;
};

const tooLarge = (max_bytes: number): Error => new Error(`the page is larger than ${String(max_bytes)} bytes`);

/** A read that gave bytes; a finished read (done) is not one. */
const isChunk = (read: unknown): read is { readonly value: Uint8Array } =>
  typeof read === "object" && read !== null && Reflect.get(read, "done") !== true && Reflect.get(read, "value") instanceof Uint8Array;

/** The body's bytes, stopping as soon as they pass max_bytes. */
const bodyBytes = async (response: Response, max_bytes: number | undefined): Promise<Uint8Array> => {
  if (max_bytes === undefined || response.body === null) return new Uint8Array(await response.arrayBuffer());
  const declared = Number(response.headers.get("content-length") ?? Number.NaN);
  if (declared > max_bytes) throw tooLarge(max_bytes);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read: unknown = await reader.read(); isChunk(read); read = await reader.read()) {
    size += read.value.byteLength;
    if (size > max_bytes) {
      await reader.cancel();
      throw tooLarge(max_bytes);
    }
    chunks.push(read.value);
  }
  return Buffer.concat(chunks);
};

export const fetchPage = async (url: string, limits: FetchLimits, fetcher: Fetcher = fetch): Promise<FetchedPage> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeout_ms);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new HttpStatusError(response.status);
    const contentType = response.headers.get("content-type");
    return { text: decodeFetched(await bodyBytes(response, limits.max_bytes), contentType), contentType };
  } catch (err) {
    throw new Error(`${url}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
};
