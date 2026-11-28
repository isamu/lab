import type { Detector, Finding, MarkupHeading, ProseDocument } from "../plugin.ts";
import { numberingStyleOf, UNNUMBERED, type NumberLabel } from "../heading-numbering.ts";
import { lineNumberAt, linesOf } from "../structure/lines.ts";
import { recordLabelOf, recordRhythmMask } from "./heading-record-rhythm.ts";
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

/**
 * 見出しを比べる範囲。ふつうは親の見出し。番号の無い見出しは、同じ親の下の同じ深さで直前の番号付きの見出し（「7.3 …」）までを範囲にする。
 * 番号付きの節とその中の「Example 1」を同じ深さに並べた文書では、番号付きの見出しが読み手にとっての親で、節ごとに数え直す例は重複でない。
 */
const scopesOf = (headings: readonly MarkupHeading[], parents: readonly number[], isNumbered: (text: string) => boolean): string[] => {
  const lastNumbered = new Map<string, number>();
  return headings.map((heading, index) => {
    const parent = String(parents[index] ?? -1);
    const row = `${parent}:${String(heading.depth)}`;
    if (isNumbered(heading.text)) lastNumbered.set(row, index);
    const section = lastNumbered.get(row);
    return section === undefined || section === index ? parent : `${parent}/${String(section)}`;
  });
};

/** 文書の題（最初の見出しが # のとき、その言葉）。ページの題を本文の頭や目次の後でもう一度掲げるのは、節の重複ではない。 */
const titleKeyOf = (headings: readonly MarkupHeading[]): string | undefined => {
  const first = headings[0];
  return first?.depth === 1 ? headingKey(first.text) : undefined;
};

export type RepeatedHeading = { readonly heading: MarkupHeading; readonly first: MarkupHeading };

/** 見出しごとに、同じ親の下の兄弟の型の並びで、決まった見出しの組をくり返す所にあるか（recordRhythmMask）。 */
const inRecordRhythm = (parents: readonly number[], keys: readonly string[]): boolean[] => {
  const byParent = new Map<number, number[]>();
  parents.forEach((parent, index) => {
    const siblings = byParent.get(parent) ?? [];
    siblings.push(index);
    byParent.set(parent, siblings);
  });
  const inRhythm = keys.map(() => false);
  byParent.forEach((indexes) => {
    const mask = recordRhythmMask(indexes.map((index) => recordLabelOf(keys[index] ?? "")));
    indexes.forEach((index, at) => {
      inRhythm[index] = mask[at] === true;
    });
  });
  return inRhythm;
};

/** 番号の付いた見出しか。番号を持つ語（Chapter 2、第2章）は言語の語彙表 heading-number-label から。 */
const numberedBy =
  (labels: readonly NumberLabel[]) =>
  (text: string): boolean =>
    numberingStyleOf(text, labels) !== UNNUMBERED;

/**
 * 同じ親の下で、前の見出しと同じ言葉の見出し（markdownlint の MD024 siblings_only）。変更履歴の版ごとの「Added」「Fixed」のように、
 * 親が違えば同じ言葉でもよい。深さが違っても親が同じなら兄弟として比べる（飛んだ深さの見出しも同じ親の下にある）。
 * 番号付きの見出しが同じ深さで区切る範囲（scopesOf）も親として扱う。事例ごとに決まった見出しの組をくり返す所（recordRhythmMask）と、
 * 文書の題をもう一度掲げた所は、文書の作りとしての重複なので言わない。
 */
export const repeatedSiblingHeadings = (headings: readonly MarkupHeading[], labels: readonly NumberLabel[] = []): RepeatedHeading[] => {
  const parents = parentIndexes(headings);
  const scopes = scopesOf(headings, parents, numberedBy(labels));
  const keys = headings.map((heading) => headingKey(heading.text));
  const inRhythm = inRecordRhythm(parents, keys);
  const title = titleKeyOf(headings);
  const seen = new Map<string, MarkupHeading>();
  return headings.flatMap((heading, index) => {
    const key = keys[index] ?? "";
    const scoped = `${scopes[index] ?? ""}\n${key}`;
    const first = seen.get(scoped);
    if (first === undefined) seen.set(scoped, heading);
    return first === undefined || key === "" || key === title || inRhythm[index] === true ? [] : [{ heading, first }];
  });
};

const numberLabelsOf = (doc: ProseDocument): NumberLabel[] =>
  (doc.lexicons["heading-number-label"] ?? []).map((entry) => ({ word: entry.pattern, position: entry.position === "after" ? "after" : "before" }));

export const duplicateHeading: Detector = (doc): Finding[] => {
  const lines = linesOf(doc.source);
  return repeatedSiblingHeadings(writtenHeadings(doc), numberLabelsOf(doc)).map(({ heading, first }) =>
    findingAt(doc, heading, { heading: heading.text, firstLine: lineNumberAt(lines, first.start) ?? 0 }),
  );
};
