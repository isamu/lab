// MediaWiki wikitext (a Wikivoyage article, as action=raw returns it) as plain Markdown: headings, paragraphs,
// lists and the text of links. Templates are dropped except the few that carry the prose's own words (a map marker's
// name, a listing's name and description, a converted quantity, a price); tables, files, references and comments are
// dropped. Pure.
import { decodeEntities, tidyLines } from "./markup-text.ts";

type Params = { readonly named: ReadonlyMap<string, string>; readonly positional: readonly string[] };

/** The index just past the `close` that balances an `open` already read, or -1 when it never closes. */
const closingOf = (text: string, open: string, close: string, from: number, depth: number): number => {
  if (depth === 0) return from;
  const nextClose = text.indexOf(close, from);
  if (nextClose === -1) return -1;
  const nextOpen = text.indexOf(open, from);
  if (nextOpen !== -1 && nextOpen < nextClose) return closingOf(text, open, close, nextOpen + open.length, depth + 1);
  return closingOf(text, open, close, nextClose + close.length, depth - 1);
};

/** Every outermost `open … close` replaced by render(inside). An unclosed opener is left as written, and what follows it is still read. */
const replaceBalanced = (text: string, open: string, close: string, render: (inside: string) => string): string => {
  const start = text.indexOf(open);
  if (start === -1) return text;
  const end = closingOf(text, open, close, start + open.length, 1);
  if (end === -1) return [text.slice(0, start + open.length), replaceBalanced(text.slice(start + open.length), open, close, render)].join("");
  const rest = replaceBalanced(text.slice(end), open, close, render);
  return [text.slice(0, start), render(text.slice(start + open.length, end - close.length)), rest].join("");
};

const DEPTH_CHANGE: Readonly<Record<string, number>> = { "{": 1, "[": 1, "}": -1, "]": -1 };

/** Split at the `|`s that are not inside a nested template or link. */
const splitTopLevel = (inside: string): string[] => {
  const split = Array.from(inside).reduce<{ readonly depth: number; readonly parts: string[][] }>(
    (state, char) => {
      if (char === "|" && state.depth === 0) return { depth: 0, parts: [...state.parts, []] };
      state.parts[state.parts.length - 1]?.push(char);
      return { depth: state.depth + (DEPTH_CHANGE[char] ?? 0), parts: state.parts };
    },
    { depth: 0, parts: [[]] },
  );
  return split.parts.map((chars) => chars.join(""));
};

/** Each value with its own templates expanded and its spaces made one, so a dropped icon leaves no gap. */
const paramsOf = (args: readonly string[]): Params => {
  const named = new Map<string, string>();
  const positional: string[] = [];
  const valueOf = (raw: string): string => expandTemplates(raw).replace(/\s+/gu, " ").trim();
  args.forEach((arg) => {
    const equals = arg.indexOf("=");
    const key = equals === -1 ? "" : arg.slice(0, equals).trim();
    if (/^[\w -]+$/u.test(key)) named.set(key, valueOf(arg.slice(equals + 1)));
    else positional.push(valueOf(arg));
  });
  return { named, positional };
};

const listing = (params: Params): string => [params.named.get("name") ?? "", params.named.get("content") ?? ""].filter((part) => part !== "").join(": ");

const priced =
  (symbol: string) =>
  (params: Params): string =>
    `${symbol}${params.positional[0] ?? ""}`;

const LISTINGS = ["see", "do", "buy", "eat", "drink", "sleep", "go", "listing"];

/** The templates whose words are part of the sentence around them. Every other template is dropped. */
const RENDERERS: Readonly<Record<string, (params: Params) => string>> = {
  ...Object.fromEntries(LISTINGS.map((name) => [name, listing])),
  marker: (params) => params.named.get("name") ?? "",
  station: (params) => params.positional[0] ?? "",
  convert: (params) => params.positional.slice(0, 2).join(" "),
  eur: priced("€"),
  usd: priced("$"),
  gbp: priced("£"),
};

const expandTemplates = (text: string): string => replaceBalanced(text, "{{", "}}", renderTemplate);

function renderTemplate(inside: string): string {
  const [head = "", ...args] = splitTopLevel(inside);
  const render = RENDERERS[head.trim().toLowerCase().replace(/_/gu, " ")];
  return render === undefined ? "" : render(paramsOf(args));
}

const DROPPED_NAMESPACES = new Set(["file", "image", "media", "category"]);

const renderLink = (inside: string): string => {
  const parts = splitTopLevel(inside);
  const target = (parts[0] ?? "").trim().replace(/^:/u, "");
  const colon = target.indexOf(":");
  if (colon !== -1 && DROPPED_NAMESPACES.has(target.slice(0, colon).trim().toLowerCase())) return "";
  return (parts.length > 1 ? parts.slice(1).join("|") : target).trim();
};

/** Tables (`{| … |}`, nested or not) are removed line by line. */
const withoutTables = (lines: readonly string[]): string[] =>
  lines.reduce<{ readonly depth: number; readonly kept: string[] }>(
    (state, line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("{|")) return { depth: state.depth + 1, kept: state.kept };
      if (state.depth > 0) return { depth: trimmed.startsWith("|}") ? state.depth - 1 : state.depth, kept: state.kept };
      return { depth: 0, kept: [...state.kept, line] };
    },
    { depth: 0, kept: [] },
  ).kept;

const inlineText = (text: string): string =>
  decodeEntities(
    replaceBalanced(expandTemplates(text), "[[", "]]", renderLink)
      .replace(/\[(?:https?:)?\/\/[^\s\]]+(?: ([^\]]*))?\]/giu, (_whole: string, label: string | undefined) => (label ?? "").trim())
      .replace(/<br\s*\/?>/giu, " ")
      .replace(/<\/?[a-z][^>]*>/giu, "")
      .replace(/'{2,5}/gu, ""),
  );

const LIST_MARK: Readonly<Record<string, string>> = { "*": "- ", "#": "1. " };

const leading = (text: string, char: string): number => {
  const other = Array.from(text).findIndex((each) => each !== char);
  return other === -1 ? text.length : other;
};

/** `== Heading ==` at levels 1 to 6: the level is the shorter of the two runs of `=`. */
const headingOf = (line: string): string | undefined => {
  const level = Math.min(leading(line, "="), leading(Array.from(line).reverse().join(""), "="), 6);
  if (level === 0 || line.length <= level * 2) return undefined;
  return `${"#".repeat(level)} ${line.slice(level, line.length - level).trim()}`;
};

const markdownLine = (line: string): string => {
  const heading = headingOf(line);
  if (heading !== undefined) return heading;
  const marks = /^[*#:;]+/u.exec(line)?.[0] ?? "";
  if (marks === "") return line;
  const body = line.slice(marks.length).trim();
  const mark = LIST_MARK[marks.slice(-1)];
  if (body === "" || mark === undefined) return body;
  return `${"  ".repeat(marks.length - 1)}${mark}${body}`;
};

export const wikitextToMarkdown = (source: string): string => {
  const cleaned = source
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<ref\b[^>]*\/>/giu, "")
    .replace(/<(ref|gallery)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, "")
    .replace(/__[A-Z]+__/gu, "");
  const text = inlineText(withoutTables(cleaned.split("\n")).join("\n"));
  return tidyLines(text.split("\n").map((line) => markdownLine(line.trim())));
};
