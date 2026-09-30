// Fetches a corpus source as text, in the encoding it declares, with a timeout. A non-2xx answer throws an error
// whose cause carries the HTTP status, so a caller can tell a dead source (404) from a transient one (503).
import { decodeFetched } from "./fetched-text.ts";

const TIMEOUT_MS = 120_000;

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${String(status)}`);
    this.status = status;
  }
}

export const fetchText = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new HttpStatusError(response.status);
    return decodeFetched(new Uint8Array(await response.arrayBuffer()), response.headers.get("content-type"));
  } catch (err) {
    throw new Error(`${url}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
};
