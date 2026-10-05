// node:path for a build without Node: the POSIX functions chaff imports, over the in-memory files of chaffjs/browser-files.
// The working folder is "/". test/test_browser_path.ts holds each function to node:path's posix one on generated paths.

export const sep = "/";

const normalizedParts = (parts: readonly string[], absolute: boolean): string[] =>
  parts.reduce<string[]>((kept, part) => {
    if (part === "" || part === ".") return kept;
    if (part !== "..") return [...kept, part];
    const last = kept.at(-1);
    if (last !== undefined && last !== "..") return kept.slice(0, -1);
    return absolute ? kept : [...kept, ".."];
  }, []);

export const normalize = (path: string): string => {
  if (path === "") return ".";
  const absolute = path.startsWith("/");
  const body = normalizedParts(path.split("/"), absolute).join("/");
  const trailing = path.endsWith("/") ? "/" : "";
  if (absolute) return body === "" ? "/" : `/${body}${trailing}`;
  return `${body === "" ? "." : body}${trailing}`;
};

export const join = (...parts: readonly string[]): string => {
  const joined = parts.filter((part) => part !== "").join("/");
  return joined === "" ? "." : normalize(joined);
};

export const isAbsolute = (path: string): boolean => path.startsWith("/");

export const resolve = (...parts: readonly string[]): string => {
  const from = parts.reduceRight((acc, part) => {
    if (acc.startsWith("/") || part === "") return acc;
    return acc === "" ? part : `${part}/${acc}`;
  }, "");
  const resolved = normalize(from.startsWith("/") ? from : `/${from}`);
  return resolved.length > 1 && resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
};

const segmentsOf = (path: string): string[] =>
  resolve(path)
    .split("/")
    .filter((part) => part !== "");

export const relative = (from: string, to: string): string => {
  const fromParts = segmentsOf(from);
  const toParts = segmentsOf(to);
  const differs = fromParts.findIndex((part, index) => toParts[index] !== part);
  const shared = differs === -1 ? Math.min(fromParts.length, toParts.length) : differs;
  return [...fromParts.slice(shared).map(() => ".."), ...toParts.slice(shared)].join("/");
};

/** The index of the last character that is not a slash, or -1. */
const lastNonSlash = (path: string): number => {
  let at = path.length - 1;
  while (at >= 0 && path[at] === "/") at -= 1;
  return at;
};

export const dirname = (path: string): string => {
  if (path === "") return ".";
  const last = lastNonSlash(path);
  const end = last <= 0 ? -1 : path.lastIndexOf("/", last);
  if (end < 1) return path.startsWith("/") ? "/" : ".";
  return end === 1 && path.startsWith("/") ? "//" : path.slice(0, end);
};

export const extname = (path: string): string => {
  const end = lastNonSlash(path) + 1;
  const name = path.slice(path.lastIndexOf("/", end - 1) + 1, end);
  const dot = name.lastIndexOf(".");
  return dot <= 0 || name === ".." ? "" : name.slice(dot);
};
