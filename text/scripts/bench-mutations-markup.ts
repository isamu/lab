// Seeded mistakes of Markdown markup for `yarn bench`: a heading that skips a level, an image with no alt text, a link to a
// heading the document does not have, and a URL with text run on after it. Pure and deterministic, like
// scripts/bench-mutations.ts.
import { codeLines, isJapanese, isProse, linesOf, replaceLine, rewriteFirst, type Plant } from "./bench-text.ts";

const HEADING = /^(#{1,6})\s/u;

const depthOf = (line: string): number | undefined => HEADING.exec(line)?.[1]?.length;

/** Markdown の見出しの深さの上限。 */
const DEEPEST = 6;

type Heading = { readonly index: number; readonly depth: number };

const headingsOf = (lines: readonly string[]): Heading[] => {
  const code = codeLines(lines);
  return lines.flatMap((line, index) => {
    const depth = depthOf(line);
    return depth === undefined || code.has(index) ? [] : [{ index, depth }];
  });
};

// --- heading-level-skip ---

/** 前の見出しと同じか浅い見出しを、前の見出しの二段下にする。文字を小さく見せたくて深さを選んだ見出し。 */
export const skipHeadingLevel = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const headings = headingsOf(lines);
  const target = headings.find((heading, at) => {
    const previous = headings[at - 1];
    return previous !== undefined && heading.depth <= previous.depth && previous.depth + 2 <= DEEPEST;
  });
  const previous = target === undefined ? undefined : headings[headings.indexOf(target) - 1];
  const line = target === undefined ? undefined : lines[target.index];
  if (target === undefined || previous === undefined || line === undefined) return undefined;
  return { source: replaceLine(lines, target.index, line.replace(HEADING, `${"#".repeat(previous.depth + 2)} `)), line: target.index + 1 };
};

// --- image-alt-text ---

const SENTENCE_END = /[。.]$/u;

const endsParagraph = (lines: readonly string[]): ((line: string, index: number) => boolean) => {
  const code = codeLines(lines);
  return (line, index) => !code.has(index) && isProse(line) && SENTENCE_END.test(line.trimEnd()) && (lines[index + 1] ?? "").trim() === "";
};

/** 最初の段落の後ろに、代替テキストの無い図を足す。 */
export const imageWithoutAlt = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lines.findIndex(endsParagraph(lines));
  const line = lines[index];
  if (line === undefined) return undefined;
  // 段落の行、空行、図の行。
  return { source: replaceLine(lines, index, `${line}\n\n![](figure.png)`), line: index + 3 };
};

// --- broken-link ---

/** 最初の文の行に、文書に無い節へのページ内リンクを足す。 */
export const linkToMissingSection = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && SENTENCE_END.test(line.trimEnd()) && !line.startsWith("|"),
    (line) => (isJapanese(line) ? `${line}詳しくは[付録](#付録)を参照してください。` : `${line} See [the appendix](#appendix).`),
  );

// --- url-run-on ---

/** 最初の日本語の文の行に、空白を置かずに言葉が続く URL を足す。 */
export const runOnUrl = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && isJapanese(line) && line.trimEnd().endsWith("。") && !line.startsWith("|"),
    (line) => `${line}案内は https://example.jp/guideにあります。`,
  );
