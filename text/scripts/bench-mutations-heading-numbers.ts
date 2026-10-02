// Seeded heading numbering for `yarn bench`: sibling headings numbered, all but the last one.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, linesOf, type Mutation, type Plant } from "./bench-text.ts";

const HEADING = /^(#{2,6})\s+(\S.*)$/u;

/** 前後の見出し（目次・参考文献）。rule が兄弟に数えないので、これを含む並びには植えない。 */
const MATTER = /^(?:目次|参考文献|付録|謝辞|Contents|References|Abstract|Appendix|Acknowledg)/iu;

/** 番号で始まる見出しの言葉。すでに番号がある兄弟は植えない。 */
const NUMBERED = /^(?:[0-9０-９]|第|[(（①-⑳]|Chapter|Step|Part|Section)/u;

type Heading = { readonly index: number; readonly depth: number; readonly text: string };

const headingsOf = (lines: readonly string[]): Heading[] => {
  const code = codeLines(lines);
  return lines.flatMap((line, index) => {
    const match = HEADING.exec(line);
    return match === null || code.has(index) ? [] : [{ index, depth: match[1]?.length ?? 0, text: match[2] ?? "" }];
  });
};

/** 最初の、同じ深さの見出しが三つ以上続く並び（あいだに浅い見出しを挟まない）。 */
const firstSiblingRun = (headings: readonly Heading[]): Heading[] | undefined => {
  const runs = headings.map((head, at) => {
    const after = headings.slice(at);
    const end = after.findIndex((other) => other.depth < head.depth);
    return (end === -1 ? after : after.slice(0, end)).filter((other) => other.depth === head.depth);
  });
  return runs.find((run) => run.length >= 3 && run.every((head) => !NUMBERED.test(head.text) && !MATTER.test(head.text)));
};

/** 兄弟の見出しに、最後の一つを除いて番号を付ける。最後の見出しだけ番号が無くなる。 */
const numberAllButLast = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const run = firstSiblingRun(headingsOf(lines));
  const last = run?.at(-1);
  if (run === undefined || last === undefined) return undefined;
  const numbered = new Map(run.slice(0, -1).map((head, at) => [head.index, `${"#".repeat(head.depth)} ${String(at + 1)}. ${head.text}`]));
  return { source: lines.map((line, index) => numbered.get(index) ?? line).join("\n"), line: last.index + 1 };
};

export const HEADING_NUMBER_MUTATIONS: readonly Mutation[] = [
  { id: "heading-numbered-but-last", rule: "heading-numbering-mix", languages: ["ja", "en"], plant: numberAllButLast },
];
