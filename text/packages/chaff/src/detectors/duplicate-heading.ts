import type { Detector, Finding, MarkupHeading } from "../plugin.ts";
import { lineNumberAt, linesOf } from "../structure/lines.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";

/** 見出しの言葉を比べる形。全角と半角、大文字と小文字、空白の数は同じ見出しの違いにしない。 */
export const headingKey = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

/** 見出しの親（一つ前の、それより浅い見出し）の位置。いちばん浅い見出しは文書が親で、-1。 */
const parentIndexes = (headings: readonly MarkupHeading[]): number[] => {
  const open: number[] = [];
  const depthAt = (at: number | undefined): number => (at === undefined ? 0 : (headings[at]?.depth ?? 0));
  return headings.map((heading, index) => {
    while (open.length > 0 && depthAt(open.at(-1)) >= heading.depth) open.pop();
    const parent = open.at(-1) ?? -1;
    open.push(index);
    return parent;
  });
};

export type RepeatedHeading = { readonly heading: MarkupHeading; readonly first: MarkupHeading };

type Seen = Map<number, Map<string, MarkupHeading>>;

/**
 * 同じ親の下で、前の見出しと同じ言葉の見出し（markdownlint の MD024 siblings_only）。変更履歴の版ごとの「Added」「Fixed」のように、
 * 親が違えば同じ言葉でもよい。深さが違っても親が同じなら兄弟として比べる（飛んだ深さの見出しも同じ親の下にある）。
 */
export const repeatedSiblingHeadings = (headings: readonly MarkupHeading[]): RepeatedHeading[] => {
  const parents = parentIndexes(headings);
  const seen: Seen = new Map();
  return headings.flatMap((heading, index) => {
    const key = headingKey(heading.text);
    const parent = parents[index] ?? -1;
    const siblings = seen.get(parent) ?? new Map<string, MarkupHeading>();
    seen.set(parent, siblings);
    const first = siblings.get(key);
    if (first === undefined) siblings.set(key, heading);
    return first === undefined || key === "" ? [] : [{ heading, first }];
  });
};

export const duplicateHeading: Detector = (doc): Finding[] => {
  const lines = linesOf(doc.source);
  return repeatedSiblingHeadings(writtenHeadings(doc)).map(({ heading, first }) =>
    findingAt(doc, heading, { heading: heading.text, firstLine: lineNumberAt(lines, first.start) ?? 0 }),
  );
};
