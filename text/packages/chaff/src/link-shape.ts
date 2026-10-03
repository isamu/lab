// What a link's text and an image's alt text look like: a URL, a host, a file name. Pure functions only.

/** Link text that reads as an address: it starts with a scheme or with `www.`. A bare `README.md` is a file, not a host. */
const URL_TEXT = /^(?:https?:\/\/|www\.)[^\s]+$/iu;

/** Marks around a link's text that are not part of the address it shows (`**https://…**`, `` `https://…` ``, `<…>`). */
const LEADING = new Set(" \t\n*_`<「『\"“'");
const TRAILING = new Set(" \t\n*_`>」』\"”'.。,，、");

/** The text as the reader sees the address, without emphasis, code marks, quotes or closing punctuation. */
export const shownAddress = (text: string): string => {
  const chars = [...text];
  const start = chars.findIndex((char) => !LEADING.has(char));
  return start === -1 ? "" : chars.slice(start, chars.findLastIndex((char) => !TRAILING.has(char)) + 1).join("");
};

/** Whether a link's text is itself an address. */
export const isUrlText = (text: string): boolean => URL_TEXT.test(shownAddress(text));

const WWW = /^www\./iu;
const WEB_SCHEME = /^https?:\/\//iu;

/** The host an address names, lower case and without `www.`; undefined for a relative path, a fragment or a mail address. */
export const hostOf = (address: string): string | undefined => {
  const written = shownAddress(address);
  const absolute = WWW.test(written) ? `https://${written}` : written;
  if (!WEB_SCHEME.test(absolute)) return undefined;
  try {
    return new URL(absolute).hostname.toLowerCase().replace(WWW, "");
  } catch {
    return undefined;
  }
};

/**
 * The host a link's text shows, when it differs from the host the link goes to. Both must be absolute web addresses;
 * a shortened display of the same host (`github.com/a` for `https://github.com/a/b/tree/main`) is the same host.
 */
export const mismatchedHost = (text: string, destination: string): { readonly shown: string; readonly target: string } | undefined => {
  if (!isUrlText(text)) return undefined;
  const shown = hostOf(text);
  const target = hostOf(destination);
  return shown === undefined || target === undefined || shown === target ? undefined : { shown, target };
};

/** The extensions of image files. An alt text that ends in one is the file's name. */
const IMAGE_FILE = /\.(?:png|jpe?g|gif|svg|webp|bmp|tiff?|heic|heif|avif|ico)$/iu;

/** After a camera's or a screenshot tool's name: separators, then the number it counts with (`IMG_1234`, `Screenshot 2026-…`). */
const COUNTER = /^[\s_-]*\d/u;

/**
 * Whether an alt text is a file's name rather than a description: it ends in an image extension (`IMG_1234.png`), or it
 * starts with a name a camera or a screenshot tool gives (`prefixes`, from the language's lexicon) followed by its number.
 */
export const isFileNameAlt = (alt: string, prefixes: readonly string[]): boolean => {
  const written = alt.trim();
  if (written === "") return false;
  if (IMAGE_FILE.test(written)) return true;
  const lowered = written.toLowerCase();
  return prefixes.some((prefix) => lowered.startsWith(prefix.toLowerCase()) && COUNTER.test(written.slice(prefix.length)));
};
