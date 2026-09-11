import type { Detector, Finding } from "../plugin.ts";

/** 節あたりの強調の数。bold-density が使う。 */
export const countPerSection: Detector = (doc, options): Finding[] =>
  doc.sections
    .filter((section) => section.strongCount > options.limit)
    .map((section) => ({
      rule: "bold-density",
      severity: "warning",
      line: 0,
      column: 0,
      // 節全体を引くと段落をまたいで読めなくなる。最初の文だけ見せて場所を示す。
      quote: section.firstSentence?.text.trim() ?? "",
      values: { count: section.strongCount, limit: options.limit, offset: section.firstSentence?.span.start ?? section.span.start },
    }));
