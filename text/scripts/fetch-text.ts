// Fetches a corpus source as text through chaff's own fetch (packages/chaff/src/html/fetch-page.ts), with the corpus's
// long timeout, and gives Node's fetch a longer time to connect.
import { fetchPage } from "../packages/chaff/src/html/fetch-page.ts";

const TIMEOUT_MS = 120_000;

/** undici, under Node's fetch, gives up connecting after 10 s; GitHub's runners reach web.archive.org slower than that at times. */
export const CONNECT_TIMEOUT_MS = 30_000;

/** Where undici keeps the dispatcher Node's fetch uses; the undici package's setGlobalDispatcher writes the same slot. */
const GLOBAL_DISPATCHER = Symbol.for("undici.globalDispatcher.1");

export const fetchText = async (url: string): Promise<string> => (await fetchPage(url, TIMEOUT_MS)).text;

const isDispatcher = (value: unknown): value is object => typeof value === "object" && value !== null && typeof Reflect.get(value, "dispatch") === "function";

/**
 * A dispatcher of the same class as current (undici's Agent) whose connect timeout is timeout_ms, or undefined when
 * current is not one. Node bundles undici without exporting Agent, so its class is taken from the running instance.
 */
export const withConnectTimeout = (current: unknown, timeout_ms: number): object | undefined => {
  if (!isDispatcher(current)) return undefined;
  const agentClass: unknown = Reflect.get(current, "constructor");
  if (typeof agentClass !== "function") return undefined;
  try {
    const agent: unknown = Reflect.construct(agentClass, [{ connect: { timeout: timeout_ms } }]);
    return isDispatcher(agent) ? agent : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Makes every later fetch in this process wait CONNECT_TIMEOUT_MS to connect. Returns false, leaving the default, when
 * the running Node does not keep an undici Agent where this expects it.
 */
export const lengthenConnectTimeout = async (): Promise<boolean> => {
  // A data: URL needs no network; fetching one makes undici create its global dispatcher if nothing has yet.
  await fetch("data:,");
  const agent = withConnectTimeout(Reflect.get(globalThis, GLOBAL_DISPATCHER), CONNECT_TIMEOUT_MS);
  return agent !== undefined && Reflect.set(globalThis, GLOBAL_DISPATCHER, agent);
};
