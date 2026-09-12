import { lengthOf } from "../measure.ts";
import type { Detector, Finding, LengthUnit, Section } from "../plugin.ts";

/** 見出しが短すぎると、偶然の一致で 100% になる。これ未満の見出しは見ない。 */
const MIN_GRAMS = 4;

/**
 * 文字 3-gram で測る。
 * 語 n-gram にすると wordSplit capability が要り、L1（言語を問わず動く）から外れる。
 */
const trigrams = (text: string): Set<string> => {
  // 大文字小文字を畳む。英語では見出しが Title Case、本文が小文字になり、
  // 同じ語でも一致しなくなる（Generating Output → generated output）。
  const clean = [...text.toLowerCase().replace(/\s+/gu, "")];
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

/**
 * 見出しの語を含んでいても、文がそのぶん以上に中身を足していれば「何も受け取れない」ではない。
 *
 * 実文書（英語 11 本）で測ったら、この条件なしでは 72.7% の文書が該当した。
 * 「## ToolsAgent」に対する「GraphAI provides ToolsAgent components that use LLMs to…」は
 * 見出しの語を含むが、読み進める価値がある。見出し以外の中身の量で分ける。
 */
const NEW_MATERIAL = { word: 6, char: 20 };

const headingUnits = (heading: string, unit: LengthUnit): number =>
  unit === "word"
    ? heading
        .trim()
        .split(/\s+/u)
        .filter((word) => word.length > 0).length
    : heading.replace(/\s+/gu, "").length;

const addsLittle = (section: Section, unit: LengthUnit): boolean => {
  const first = section.firstSentence;
  if (first === undefined) return false;
  return lengthOf(first, unit) - headingUnits(section.heading, unit) <= NEW_MATERIAL[unit];
};

export const headingEcho: Detector = (doc, options): Finding[] =>
  doc.sections
    .filter((section) => section.heading.length > 0 && section.firstSentence !== undefined && addsLittle(section, doc.lengthUnit))
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
