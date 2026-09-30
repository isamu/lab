import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import type { Span } from "./plugin.ts";

/** `closer` finds where each `close` starts. */
type Delimiters = { readonly open: string; readonly close: string; readonly closer: RegExp };

/**
 * Template and MDX syntax written into the text: Liquid and Jinja tags (`{% ifversion %}`,
 * `{% data variables.product.github %}`), outputs (`{{ page.title }}`, which also covers Hugo's shortcodes
 * `{{< note >}}` and `{{% alert %}}`) and comments (`{# … #}`), and MDX comments (a block comment in braces).
 */
const DELIMITERS: readonly Delimiters[] = [
  { open: "{%", close: "%}", closer: /%\}/gu },
  { open: "{{", close: "}}", closer: /\}\}/gu },
  { open: "{#", close: "#}", closer: /#\}/gu },
  { open: "{/*", close: "*/}", closer: /\*\/\}/gu },
];

const OPENER = /\{(?=[{%#]|\/\*)/gu;

// A tag never runs past a blank line: an unclosed `{{` is a character in the text, not a tag that swallows the page.
const BLANK_LINE = /\n[ \t]*\n/gu;

const stretchesOf = (text: string): Span[] => {
  const breaks = [...text.matchAll(BLANK_LINE)];
  const starts = [0, ...breaks.map((blank) => blank.index + blank[0].length)];
  return starts.map((start, index) => ({ start, end: breaks[index]?.index ?? text.length }));
};

/** The first of the sorted `positions` at or after `from`. */
const firstAtOrAfter = (positions: readonly number[], from: number, low = 0, high = positions.length): number | undefined => {
  if (low >= high) return positions[low];
  const middle = (low + high) >> 1;
  return (positions[middle] ?? from) >= from ? firstAtOrAfter(positions, from, low, middle) : firstAtOrAfter(positions, from, middle + 1, high);
};

/**
 * The tags in one stretch, left to right: each opener closes at the first closer after it, and an opener inside a tag
 * opens nothing. Each opener looks its closer up instead of scanning for it, so a line of unclosed openers is linear.
 */
const tagsIn = (stretch: string): Span[] => {
  const closers = DELIMITERS.map(({ closer }) => [...stretch.matchAll(closer)].map((match) => match.index));
  return [...stretch.matchAll(OPENER)].reduce<Span[]>((tags, { index }) => {
    if (index < (tags.at(-1)?.end ?? 0)) return tags;
    const kind = DELIMITERS.findIndex(({ open }) => stretch.startsWith(open, index));
    const delimiters = DELIMITERS[kind];
    const close = delimiters === undefined ? undefined : firstAtOrAfter(closers[kind] ?? [], index + delimiters.open.length);
    if (delimiters !== undefined && close !== undefined) tags.push({ start: index, end: close + delimiters.close.length });
    return tags;
  }, []);
};

/** Where the template syntax stands. Read `code` with code already blanked, so a `{{` inside backticks opens nothing. */
export const templateSpans = (code: string): Span[] =>
  stretchesOf(code).flatMap((stretch) =>
    tagsIn(code.slice(stretch.start, stretch.end)).map((tag) => ({ start: stretch.start + tag.start, end: stretch.start + tag.end })),
  );

/** A line that starts with a JSX element's tag (`<Tabs>`, `</Tabs>`). HTML's tags are lower case and stay HTML. */
const COMPONENT_START = /^[ \t]*<\/?[A-Z][^\n]*$/gmu;

const QUOTED = /"[^"\n]*"|'[^'\n]*'/gu;

/** Tags and nothing else, once quoted values are emptied and expressions taken out: `<TabItem value= label=>`. */
const TAGS_ONLY = /^[ \t]*(?:<\/?[A-Za-z][\w.:-]*(?:[ \t][^<>{}]*)?>[ \t]*)+$/u;

/** The line without its brace expressions, however deeply they nest; undefined when its braces do not balance. */
const withoutExpressions = (line: string): string | undefined => {
  const kept: string[] = [];
  const depth = [...line.replace(QUOTED, '""')].reduce((level, char) => {
    if (level < 0) return level;
    if (char === "{") return level + 1;
    if (char === "}") return level - 1;
    if (level === 0) kept.push(char);
    return level;
  }, 0);
  return depth === 0 ? kept.join("") : undefined;
};

const isComponentLine = (line: string): boolean => {
  const bare = withoutExpressions(line);
  return bare !== undefined && TAGS_ONLY.test(bare);
};

/**
 * Lines of nothing but JSX tags. MDX reads such a line as a block of its own, so the text on the next line is a
 * paragraph; CommonMark reads it as the start of an HTML block that runs to the next blank line and hides that text.
 */
export const componentLines = (source: string): Span[] =>
  [...source.matchAll(COMPONENT_START)]
    .filter((match) => isComponentLine(match[0]))
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));

const IMPORT_START = /^import(?:\s|\{)/u;
// The module's name in quotes ends the statement: "import data from 'CSV' before review." goes on, so it is prose.
const IMPORT_FROM = /(?:[\s}*]from\s*|^import\s*)["'][^"'\n]*["'];?[ \t]*(?:\n|$)/u;

/** JavaScript's shapes of `export`, read on the first line, so that "export default reports from…" stays a sentence. */
const EXPORT_SHAPES: readonly RegExp[] = [
  /^export\s+(?:async\s+)?function\b/u,
  /^export\s+class\s+[\w$]/u,
  /^export\s+(?:const|let|var)\s+[\w${[][^=]*=/u,
  /^export\s+default\s+(?:async\s+)?(?:function|class)\b/u,
  /^export\s+default\s*[{(["'`<]/u,
  /^export\s+default\s+[\w$.]+\s*\(/u,
  /^export\s+default\s+[\w$]+(?:\.[\w$]+)*;?\s*$/u,
  /^export\s*[{*]/u,
];

const isExport = (paragraph: string): boolean => {
  const firstLine = paragraph.split("\n", 1)[0] ?? "";
  return EXPORT_SHAPES.some((shape) => shape.test(firstLine));
};

/** A paragraph that is MDX's `import`/`export` block: JavaScript, which MDX runs to the next blank line. */
const isModuleBlock = (paragraph: string): boolean => (IMPORT_START.test(paragraph) && IMPORT_FROM.test(paragraph)) || isExport(paragraph);

/** MDX's `import`/`export` lines: JavaScript, and only at the top level of the page. */
export const moduleBlocks = (root: MarkdownNode, source: string): Span[] =>
  (root.children ?? []).flatMap((node) => {
    const span = node.type === "paragraph" ? spanOf(node) : undefined;
    return span !== undefined && isModuleBlock(source.slice(span.start, span.end)) ? [span] : [];
  });

/** `[!NOTE]` and the like opening a quote: a GitHub alert (Obsidian's callouts write the same). */
const alertMarkerAt = (source: string, start: number): Span | undefined => {
  const marker = /\[![A-Za-z]+\][^\n]*/uy;
  marker.lastIndex = start;
  return marker.test(source) ? { start, end: marker.lastIndex } : undefined;
};

const QUOTE_MARK = /^[ \t]*>[ \t]?/gmu;

/** The `>` that opens each line of a quote spanning `quote`: the quote's own mark, not its text. */
const quoteMarks = (source: string, quote: Span): Span[] =>
  [...source.slice(quote.start, quote.end).matchAll(QUOTE_MARK)].map((match) => ({
    start: quote.start + match.index,
    end: quote.start + match.index + match[0].length,
  }));

/**
 * A GitHub alert (`> [!NOTE]`) is the writer's own text set in a box, not a quote: only its marker line and the `>` of
 * each line are not prose. Undefined when the quote is not an alert.
 */
const alertMarks = (quote: MarkdownNode, whole: Span, source: string): Span[] | undefined => {
  const first = quote.children?.[0];
  const start = first?.type === "paragraph" ? spanOf(first)?.start : undefined;
  const marker = start === undefined ? undefined : alertMarkerAt(source, start);
  return marker === undefined ? undefined : [marker, ...quoteMarks(source, whole)];
};

/**
 * Reads the alerts of one walk over the tree in pre-order: the marks of each alert, undefined for any other node. A
 * quote inside a quote is quoted, even one that opens like an alert; pre-order meets the outer quote first.
 */
export const alertReader = (source: string): ((node: MarkdownNode) => Span[] | undefined) => {
  const outer = { end: -1 };
  return (node) => {
    const quote = node.type === "blockquote" ? spanOf(node) : undefined;
    if (quote === undefined || quote.start < outer.end) return undefined;
    outer.end = quote.end;
    return alertMarks(node, quote, source);
  };
};
