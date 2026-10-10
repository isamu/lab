import type { MarkupHeading, ProseDocument } from "../plugin.ts";
import { codesAfterLabels, codesInTitle, modelCodeVariants } from "../model-codes.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { tableBodyCells } from "../facts/table-facts.ts";
import { proseWithCells } from "../table-cells.ts";

// 型番の欄の語（型番、Model No.）は語彙表 model-code-label が言う。

type ModelCodeFinding = { readonly offset: number; readonly name: string; readonly usual: string; readonly kind: string };

/** 文書の題: 一番浅い見出しのうち最初のもの。 */
const titleOf = (doc: ProseDocument): MarkupHeading | undefined => {
  const headings = doc.markup?.headings ?? [];
  const top = Math.min(...headings.map((heading) => heading.depth));
  return headings.find((heading) => heading.depth === top);
};

/** 題か型番の欄に書いた型番を、ほかの所（題・表の升も）で別の形に書いた所。prose は見出しと表を覆うので、題と升の字を書き戻して読む。 */
export const modelCodeFindings = (doc: ProseDocument, prose: string): ModelCodeFinding[] => {
  const title = titleOf(doc);
  const titleSpans = title === undefined ? [] : [{ start: title.start, end: title.end, text: doc.source.slice(title.start, title.end) }];
  const text = proseWithCells(prose, [...titleSpans, ...(doc.tableCells?.() ?? tableBodyCells(proseAndTablesOf(doc)))]);
  const labels = (doc.lexicons["model-code-label"] ?? []).map((entry) => entry.pattern);
  const titleCodes = title === undefined ? [] : codesInTitle(text, title.start, title.end);
  const anchors = [...titleCodes, ...codesAfterLabels(text, labels)].toSorted((left, right) => left.offset - right.offset);
  return modelCodeVariants(text, anchors).map(({ code, usual }) => ({ offset: code.offset, name: code.surface, usual, kind: "model-code" }));
};
