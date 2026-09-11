import type { Detector, Finding } from "../plugin.ts";

/** 見出しが短すぎると、偶然の一致で 100% になる。これ未満の見出しは見ない。 */
const MIN_GRAMS = 4;

/**
 * 文字 3-gram で測る。
 * 語 n-gram にすると wordSplit capability が要り、L1（言語を問わず動く）から外れる。
 */
const trigrams = (text: string): Set<string> => {
  const clean = [...text.replace(/\s+/gu, "")];
  return new Set(clean.slice(0, Math.max(0, clean.length - 2)).map((__char, index) => clean.slice(index, index + 3).join("")));
};

/**
 * Jaccard ではなく包含率を使う。
 *
 * この rule が測りたいのは「見出しのどれだけが繰り返されたか」であって、
 * 両者がどれだけ似ているかではない。見出しを丸ごと含んだうえで説明を続ける文は、
 * 文が長いというだけで Jaccard が下がってしまい、いちばん典型的な反復を取り逃す。
 * （「## キャッシュの仕組み」→「キャッシュの仕組みについて説明します。」で Jaccard 44%）
 */
const containment = (heading: Set<string>, sentence: Set<string>): number => {
  if (heading.size < MIN_GRAMS || sentence.size === 0) return 0;
  return [...heading].filter((gram) => sentence.has(gram)).length / heading.size;
};

export const headingEcho: Detector = (doc, options): Finding[] =>
  doc.sections
    .filter((section) => section.heading.length > 0 && section.firstSentence !== undefined)
    .map((section) => ({ section, overlap: Math.round(containment(trigrams(section.heading), trigrams(section.firstSentence?.text ?? "")) * 100) }))
    .filter(({ overlap }) => overlap >= options.limit)
    .map(({ section, overlap }) => ({
      rule: "heading-echo",
      severity: "warning",
      line: 0,
      column: 0,
      quote: section.firstSentence?.text.trim() ?? "",
      values: { heading: section.heading, count: overlap, limit: options.limit, offset: section.firstSentence?.span.start ?? section.span.start },
    }));
