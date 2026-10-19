// The path a link's text shows against the path the link goes to, on the same host. Pure functions only.
import { shownAddress } from "./link-shape.ts";

/** An address written without a scheme: a host with a dot and a top-level name, then a path (`github.com/clef/handbook`). */
const BARE_ADDRESS = /^[a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,}\/[^\s]*$/iu;
const WEB_SCHEME = /^https?:\/\//iu;
const WWW = /^www\./iu;

/** A backslash that Markdown writes before a punctuation mark (`criticality\_score`); the reader sees the mark alone. */
const MARKDOWN_ESCAPE = /\\([!-/:-@[-`{-~])/gu;

/** A display shortened in the middle (`github.com/a/…/main`) does not show the whole path. */
const ELLIPSIS = /…|\.\.\./u;

type Shown = { readonly host: string; readonly segments: readonly string[] };

const addressOf = (written: string): URL | undefined => {
  const absolute = WEB_SCHEME.test(written) ? written : `https://${written}`;
  try {
    return new URL(absolute);
  } catch {
    return undefined;
  }
};

/** A directory's index page (`/docs/index.html`) is the directory (`/docs`) on most servers. */
const INDEX_PAGE = /^index\.[a-z]{2,5}$/u;

const decoded = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/** The path's segments as a reader compares them: decoded, in lower case, without a trailing index page. */
const segmentsOf = (url: URL): string[] => {
  const segments = url.pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => decoded(segment).toLowerCase());
  return INDEX_PAGE.test(segments.at(-1) ?? "") ? segments.slice(0, -1) : segments;
};

/** The host and path segments a link's text shows, when the text is an address with a path; undefined otherwise. */
const shownPathOf = (text: string): Shown | undefined => {
  const written = shownAddress(text).replace(MARKDOWN_ESCAPE, "$1");
  const addressLike = WEB_SCHEME.test(written) || WWW.test(written) || BARE_ADDRESS.test(written);
  if (!addressLike || ELLIPSIS.test(written)) return undefined;
  const url = addressOf(written);
  if (url === undefined) return undefined;
  const segments = segmentsOf(url);
  return segments.length === 0 ? undefined : { host: url.hostname.toLowerCase().replace(WWW, ""), segments };
};

/**
 * The address a link's text shows and the one it goes to, when both are on the same host but the shown path is not the
 * start of the target's path (`[github.com/clef/handbook](https://github.com/handbook)`). A shortened display
 * (`github.com/a` for `https://github.com/a/b/tree/main`) shows the start of the path and is not reported.
 */
export const mismatchedPath = (text: string, destination: string): { readonly shown: string; readonly target: string } | undefined => {
  const shown = shownPathOf(text);
  const target = WEB_SCHEME.test(destination) ? addressOf(destination) : undefined;
  if (shown === undefined || target === undefined) return undefined;
  const targetHost = target.hostname.toLowerCase().replace(WWW, "");
  const targetSegments = segmentsOf(target);
  if (shown.host !== targetHost || shown.segments.every((segment, at) => targetSegments[at] === segment)) return undefined;
  return { shown: [shown.host, ...shown.segments].join("/"), target: [targetHost, ...targetSegments].join("/") };
};
