// MediaWiki wikitext (a Wikivoyage or Wikisource page, as action=raw returns it) as plain Markdown: headings,
// paragraphs, lists and the text of links. Templates are dropped except the few that carry the prose's own words (a
// map marker's name, a listing's name and description, a converted quantity, a price, a phone number, the text a layout
// template or a quotation wraps); tables, files, references and comments are dropped. Pure.
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

const paramsOf = (args: readonly string[], valueOf: (raw: string) => string): Params => {
  const named = new Map<string, string>();
  const positional: string[] = [];
  args.forEach((arg) => {
    const equals = arg.indexOf("=");
    const key = equals === -1 ? "" : arg.slice(0, equals).trim();
    if (/^[\w -]+$/u.test(key)) named.set(key, valueOf(arg.slice(equals + 1)));
    else positional.push(valueOf(arg));
  });
  return { named, positional };
};

/** vCard documents `content` as another name for `description`. */
const descriptionOf = (params: Params): string => ["content", "description"].map((key) => params.named.get(key) ?? "").find((value) => value !== "") ?? "";

const listing = (params: Params): string => [params.named.get("name") ?? "", descriptionOf(params)].filter((part) => part !== "").join(": ");

const priced =
  (symbol: string) =>
  (params: Params): string =>
    `${symbol}${params.positional[0] ?? ""}`;

/** A template that shows its first value in a unit, as {{convert}} does without the conversion: {{km|10}} is "10 km". */
const measured =
  (unit: string) =>
  (params: Params): string =>
    `${params.positional[0] ?? ""} ${unit}`;

const LISTINGS = ["see", "do", "buy", "eat", "drink", "sleep", "go", "listing", "vcard"];

/** Templates that are {{convert}} with a fixed unit, and the unit they show. */
const UNITS: Readonly<Record<string, string>> = { km: "km", kilometer: "km", ha: "ha", hectare: "ha" };

/** The templates whose words are part of the sentence around them. Every other template is dropped. */
const RENDERERS: Readonly<Record<string, (params: Params) => string>> = {
  ...Object.fromEntries(LISTINGS.map((name) => [name, listing])),
  marker: (params) => params.named.get("name") ?? "",
  station: (params) => params.positional[0] ?? "",
  ...Object.fromEntries(Object.entries(UNITS).map(([name, unit]) => [name, measured(unit)])),
  convert: (params) => params.positional.slice(0, 2).join(" "),
  eur: priced("€"),
  usd: priced("$"),
  gbp: priced("£"),
  jpy: priced("¥"),
  phone: (params) => params.positional[0] ?? "",
};

/**
 * What the converter drops leaves this mark, so only its gap is closed: "Airport {{IATA|OST}}, but" becomes
 * "Airport, but", and "a {{x}} b" becomes "a b". Spaces the writer typed ("Wait ... then") are left as they are.
 */
const DROPPED = "\uE000";
/** Drops next to each other, with or without spaces between, are one drop. */
const DROPPED_SPACED = /\uE000[ \t]+(?=\uE000)/gu;
const DROPPED_RUN = /\uE000{2,}/gu;
const DROPPED_GAP = /[ \t]?\uE000(?:([,.;:!?)])|[ \t])/gu;

/** The nth value, whether written in its place or by number (`1=` lets the text hold an `=`). */
const valueAt = (params: Params, n: number): string | undefined => params.named.get(String(n)) ?? params.positional[n - 1];

const firstValue = (params: Params): string => valueAt(params, 1) ?? "";

/** {{center}} and {{quote}} also take their text by name. */
const textValue = (params: Params): string => params.named.get("text") ?? firstValue(params);

/** {{resize|size|text}}, or {{resize|text}} in a default smaller size. */
const resizedText = (params: Params): string => valueAt(params, 2) ?? firstValue(params);

// The mark on each side of the text of a template drawn as a block of its own (a <div> on the page), where the text is
// set apart from what surrounds it.
const BLOCK_EDGE = "\uE001";

const block =
  (textOf: (params: Params) => string) =>
  (params: Params): string =>
    `${BLOCK_EDGE}${textOf(params)}${BLOCK_EDGE}`;

/**
 * Templates that only lay out or size the text they wrap (Wikisource's centred 主文 and 理由, a signature set to the
 * right), and a quotation: they show as their text, with its lines as written. A second value is an offset or a size,
 * never text, except in {{resize}}; a quotation's author and source are left out, since the wikis number them differently.
 */
const WRAPPERS: Readonly<Record<string, (params: Params) => string>> = {
  center: block(textValue),
  c: block(textValue),
  "block center": block(firstValue),
  bc: block(firstValue),
  right: block(firstValue),
  left: block(firstValue),
  quote: block(textValue),
  larger: firstValue,
  smaller: firstValue,
  resize: resizedText,
};

/** Each value with its own templates expanded and its spaces made one, so a dropped icon leaves no gap. */
const inlineValue = (raw: string): string => expandTemplates(raw).replace(/\s+/gu, " ").trim();

/** Each value with its own templates expanded and its lines kept. */
const textBlockValue = (raw: string): string => expandTemplates(raw).trim();

const expandTemplates = (text: string): string => replaceBalanced(text, "{{", "}}", renderTemplate);

function renderTemplate(inside: string): string {
  const [head = "", ...args] = splitTopLevel(inside);
  const name = head.trim().toLowerCase().replace(/_/gu, " ");
  const wrapper = WRAPPERS[name];
  if (wrapper !== undefined) return wrapper(paramsOf(args, textBlockValue));
  const render = RENDERERS[name];
  return render === undefined ? DROPPED : render(paramsOf(args, inlineValue));
}

/** A heading, a list item, an indented line or a definition: one line that a paragraph break would cut in two. */
const MARKED_LINE = /^[ \t]*[=*#:;]/u;

/**
 * A block template's text is a paragraph of its own, as the page shows a <div> apart from the text beside it; on a
 * heading or list line it stays inline, so that the line is not broken.
 */
const withBlocksApart = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replaceAll(BLOCK_EDGE, MARKED_LINE.test(line) ? "" : "\n\n"))
    .join("\n");

// 日本語版のウィキ（Wikivoyage・Wikisource）は、同じ名前空間を日本語の名前でも書く。
const DROPPED_NAMESPACES = new Set(["file", "image", "media", "category", "ファイル", "画像", "メディア", "カテゴリ"]);

const renderLink = (inside: string): string => {
  const parts = splitTopLevel(inside);
  const target = (parts[0] ?? "").trim().replace(/^:/u, "");
  const colon = target.indexOf(":");
  if (colon !== -1 && DROPPED_NAMESPACES.has(target.slice(0, colon).trim().toLowerCase())) return DROPPED;
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
      .replace(/\[(?:https?:)?\/\/[^\s\]]+(?: ([^\]]*))?\]/giu, (_whole: string, label: string | undefined) => (label === undefined ? DROPPED : label.trim()))
      .replace(/<br\s*\/?>/giu, " ")
      .replace(/<\/?[a-z][^>]*>/giu, "")
      .replace(/'{2,5}/gu, ""),
  )
    .replace(DROPPED_SPACED, "")
    .replace(DROPPED_RUN, DROPPED)
    .replace(DROPPED_GAP, (_gap: string, after: string | undefined) => after ?? " ")
    .replace(/\uE000/gu, "");

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
  const text = withBlocksApart(inlineText(withoutTables(cleaned.split("\n")).join("\n")));
  return tidyLines(text.split("\n").map((line) => markdownLine(line.trim())));
};
