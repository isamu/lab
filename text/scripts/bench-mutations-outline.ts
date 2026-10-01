// Seeded mistakes of a document's outline for `yarn bench`: a section copied with its heading unchanged, and a section
// whose content was deleted with its heading left behind. Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, linesOf, type Mutation, type Plant } from "./bench-text.ts";

const HEADING = /^(#{1,6}) (.*)$/u;

type Heading = { readonly index: number; readonly depth: number; readonly text: string };

const headingsOf = (lines: readonly string[]): Heading[] => {
  const code = codeLines(lines);
  return lines.flatMap((line, index) => {
    const match = HEADING.exec(line);
    const marks = match?.[1];
    return marks === undefined || code.has(index) ? [] : [{ index, depth: marks.length, text: match?.[2] ?? "" }];
  });
};

/** 見出し at の次の兄弟（間の見出しはどれも深い）。無ければ undefined。 */
const nextSibling = (headings: readonly Heading[], at: number): Heading | undefined => {
  const heading = headings[at];
  if (heading === undefined) return undefined;
  const following = headings.slice(at + 1);
  const end = following.findIndex((other) => other.depth <= heading.depth);
  const sibling = following[end];
  return sibling?.depth === heading.depth ? sibling : undefined;
};

// --- duplicate-heading ---

/** 最初の兄弟の組の、後ろの見出しを前の見出しと同じ言葉にする。節を写して見出しを直し忘れたもの。 */
export const copySiblingHeading = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const headings = headingsOf(lines);
  const pair = headings.map((heading, at) => ({ heading, sibling: nextSibling(headings, at) })).find(({ sibling }) => sibling !== undefined);
  if (pair?.sibling === undefined) return undefined;
  const { heading, sibling } = pair;
  const rewritten = lines.map((line, index) => (index === sibling.index ? `${"#".repeat(sibling.depth)} ${heading.text}` : line));
  return { source: rewritten.join("\n"), line: sibling.index + 1 };
};

// --- empty-section ---

/** 次の兄弟の見出しまでが本文だけの最初の節の、本文を消す。中身を消して見出しが残ったもの。 */
export const emptyFirstSection = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const headings = headingsOf(lines);
  const at = headings.findIndex((heading, index) => {
    const next = headings[index + 1];
    return next !== undefined && next.depth <= heading.depth && next.index > heading.index + 1;
  });
  const heading = headings[at];
  const next = headings[at + 1];
  if (heading === undefined || next === undefined) return undefined;
  const kept = [...lines.slice(0, heading.index + 1), "", ...lines.slice(next.index)];
  return { source: kept.join("\n"), line: heading.index + 1 };
};

export const OUTLINE_MUTATIONS: readonly Mutation[] = [
  { id: "heading-copied", rule: "duplicate-heading", languages: ["ja", "en"], plant: copySiblingHeading },
  { id: "section-emptied", rule: "empty-section", languages: ["ja", "en"], plant: emptyFirstSection },
];
