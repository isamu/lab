import type { Detector, Finding, MarkupImage } from "../plugin.ts";
import { findingAt, markupOf, quoteOf } from "./markup-finding.ts";

/** 代替テキストの無い画像。Markdown の `![](a.png)` は alt が空、HTML の `<img>` は alt 属性が無いもの。`alt=""` は飾りと明示したので数えない。 */
const lacksAlt = (source: string, image: MarkupImage): boolean => {
  if (image.alt === undefined) return true;
  return image.alt.trim() === "" && !source.startsWith("<", image.start);
};

export const imageAltText: Detector = (doc): Finding[] =>
  (markupOf(doc)?.images ?? []).filter((image) => lacksAlt(doc.source, image)).map((image) => findingAt(doc, image, { image: quoteOf(doc.source, image) }));
