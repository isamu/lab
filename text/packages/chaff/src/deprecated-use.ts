// A name the document calls deprecated (`indent` is deprecated; | `indent` | 0 | 非推奨 |) still used in one of its code
// examples ({ indent: 2 }, --indent, indent=2). Pure; reads the Markdown source. The words that mark a name deprecated
// (deprecated, 非推奨) and the phrases that negate them come from the language's lexicons.
import { codeFences } from "./detectors/code-fences.ts";

/** A deprecated name used in code: where it is used, and where the document calls it deprecated. */
export type DeprecatedUse = { readonly name: string; readonly offset: number; readonly marked: number };

/** The lowercase words that mark a name deprecated, and the phrases that negate one ("not deprecated", 非推奨ではな). */
export type DeprecationWords = { readonly words: readonly string[]; readonly negated: readonly string[] };

type Line = { readonly text: string; readonly start: number };
type Marked = { readonly name: string; readonly offset: number };
type Span = { readonly start: number; readonly end: number };
type Found = { readonly at: number; readonly end: number };

/** A name in code marks: `indent`, or the flag `--indent`, which is the name indent. */
const CODE_SPAN = /`-{0,2}([A-Za-z_$][\w$-]*)`/gu;
const FIRST_CELL_NAME = /`-{0,2}([A-Za-z_$][\w$-]*)`|^\s*-{0,2}([A-Za-z_$][\w$-]*)\s*$/u;
const TABLE_ROW = /^[ \t]{0,3}\|/u;
/** An anchor before a field name in a table cell: <a name="schemaExample"></a>example. */
const HTML_TAG = /<[^<>]*>/gu;
/** Where one statement ends: a sentence or a clause after a semicolon ("`indent` is deprecated; use `prefix`"). */
const STATEMENT_END = /[.;。；!?！？]/u;
/** A block that declares an API (interface Options { indent: number }) documents the name, and does not use it. */
const DECLARATION_BLOCK = /^[ \t]*(?:export[ \t]+)?(?:interface|class|type[ \t]+[\w$]+[ \t]*=)/mu;

const linesOf = (source: string): Line[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1), start }));
};

const insideOne = (spans: readonly Span[], offset: number): boolean => spans.some((span) => offset >= span.start && offset < span.end);

const occurrences = (text: string, words: readonly string[]): Found[] => {
  const lower = text.toLowerCase();
  return words.flatMap((word) => {
    const found: Found[] = [];
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) found.push({ at, end: at + word.length });
    return found;
  });
};

/** The deprecation words in a text, less those inside a negated phrase ("is not deprecated"). */
const wordsIn = (text: string, words: DeprecationWords): Found[] => {
  const negated = occurrences(text, words.negated);
  return occurrences(text, words.words).filter((word) => !negated.some((phrase) => phrase.at <= word.at && word.end <= phrase.end));
};

/** Characters between a code span and the word: "`indent` を非推奨" is nearer than "非推奨にし、`prefix`". */
const gap = (span: Found, word: Found): number => (span.end <= word.at ? word.at - span.end : span.at - word.end);

/** A table row's first-cell name, and whether its later cells call it deprecated. */
const rowOf = (line: Line, words: DeprecationWords): (Marked & { readonly deprecated: boolean }) | undefined => {
  const cells = line.text.split("|");
  const first = cells.findIndex((cell) => cell.trim() !== "");
  if (first === -1) return undefined;
  const name = FIRST_CELL_NAME.exec((cells[first] ?? "").replace(HTML_TAG, ""));
  const written = name?.[1] ?? name?.[2];
  const deprecated = wordsIn(cells.slice(first + 1).join("|"), words).length > 0;
  return written === undefined ? undefined : { name: written, offset: line.start + line.text.indexOf(written), deprecated };
};

const markedInRow = (line: Line, words: DeprecationWords): Marked[] => {
  const row = rowOf(line, words);
  return row?.deprecated === true ? [{ name: row.name, offset: row.offset }] : [];
};

/**
 * Names a table also lists without calling them deprecated: one page may describe two fields of one name, of which only
 * one is deprecated (an example field of one object, and of another), and an example cannot tell which it uses.
 */
const listedAlive = (lines: readonly Line[], words: DeprecationWords): Set<string> =>
  new Set(
    lines.flatMap((line) => (line.text.includes("|") ? [rowOf(line, words)] : [])).flatMap((row) => (row === undefined || row.deprecated ? [] : [row.name])),
  );

/** In a statement, the code name nearest to each deprecation word: "`indent` is deprecated", "Deprecated: `indent`". */
const markedInProse = (line: Line, words: DeprecationWords): Marked[] =>
  wordsIn(line.text, words).flatMap((word) => {
    const { at } = word;
    const from = Math.max(...[...line.text.slice(0, at).matchAll(new RegExp(STATEMENT_END, "gu"))].map((match) => match.index + 1), 0);
    const after = line.text.slice(at).search(STATEMENT_END);
    const to = after === -1 ? line.text.length : at + after;
    const spans = [...line.text.slice(from, to).matchAll(CODE_SPAN)].map((match) => ({
      name: match[1] ?? "",
      at: from + match.index,
      end: from + match.index + match[0].length,
    }));
    const nearest = spans.toSorted((left, right) => gap(left, word) - gap(right, word))[0];
    return nearest === undefined ? [] : [{ name: nearest.name, offset: line.start + line.text.indexOf(nearest.name, nearest.at) }];
  });

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** A name used as an option in code: a key ({ indent: 2 }, "indent": 2), an argument (indent=2) or a flag (--indent). */
const usePattern = (name: string): RegExp =>
  new RegExp(`(?:(?<![\\w$.-])["']?${escape(name)}["']?[ \\t]*(?::(?!:)|=(?!=))|(?<![\\w-])--${escape(name)}(?![\\w-]))`, "u");

const usesIn = (line: Line, marks: ReadonlyMap<string, number>): DeprecatedUse[] =>
  [...marks].flatMap(([name, marked]) => {
    const match = usePattern(name).exec(line.text);
    return match === null ? [] : [{ name, offset: line.start + match.index + match[0].indexOf(name), marked }];
  });

/**
 * The code lines that use a name the document calls deprecated. A code line that says so itself (`indent: 2 // deprecated`)
 * shows the old use on purpose and is left out, and so is a block that declares an API rather than using it.
 */
export const deprecatedUses = (source: string, words: DeprecationWords): DeprecatedUse[] => {
  if (words.words.length === 0) return [];
  const fences = codeFences(source);
  const lines = linesOf(source);
  const prose = lines.filter((line) => !insideOne(fences, line.start));
  const alive = listedAlive(prose, words);
  const marked = prose
    .flatMap((line) => (TABLE_ROW.test(line.text) ? markedInRow(line, words) : markedInProse(line, words)))
    .filter((mark) => !alive.has(mark.name));
  const firstMark = new Map(marked.toReversed().map((mark) => [mark.name, mark.offset]));
  const examples = fences.filter((fence) => !DECLARATION_BLOCK.test(source.slice(fence.start, fence.end)));
  return lines.filter((line) => insideOne(examples, line.start) && wordsIn(line.text, words).length === 0).flatMap((line) => usesIn(line, firstMark));
};
