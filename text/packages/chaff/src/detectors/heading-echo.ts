import { lengthOf, proseText } from "../measure.ts";
import { newContentMorphemes } from "./content-morphemes.ts";
import { echoedHeadingUnits, trigrams } from "./heading-overlap.ts";
import { handsOver } from "./lead-in.ts";
import { withoutQuotedVariants } from "./quoted-variant.ts";
import type { Detector, Finding, LengthUnit, ProseDocument, Section } from "../plugin.ts";

/** 見出しが短すぎると、偶然の一致で 100% になる。これ未満の見出しは見ない。 */
const MIN_GRAMS = 4;

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

/**
 * 空白で語を分けない言語は、品詞が読めれば文字ではなく見出しに無い内容語で測る。文字数は中身の量を言わない:
 * 「会社に勤めています」は 9 文字で 会社・勤める を足し、「について説明します」は同じ 9 文字で 説明 しか足さない。
 * 内容語 2 つで足りる（こころさんのお父さんは、会社に勤めています。）。日本語の corpus で測った（yarn corpus）。
 */
const NEW_CONTENT_MORPHEMES = 1;

/** 重なりを測る見出し。頭の番号の札（例 3：、Step 3:、1.）は本文で繰り返されないので、数えると短い見出しほど重なりが下がる。 */
const measuredHeading = (section: Section): string => section.unlabeledHeading ?? section.heading;

const addsLittle = (section: Section, unit: LengthUnit): boolean => {
  const first = section.firstSentence;
  if (first === undefined) return false;
  if (unit === "char" && first.tokens !== undefined && section.headingTokens !== undefined)
    return newContentMorphemes(section.headingTokens, first.tokens) <= NEW_CONTENT_MORPHEMES;
  return lengthOf(first, unit) - echoedHeadingUnits(measuredHeading(section), proseText(first), unit) <= NEW_MATERIAL[unit];
};

/** 最初の文が、同じ節の後ろ（箇条書き・表・コード）へ読者を渡している。 */
const leadsIn = (doc: ProseDocument, section: Section, phrases: readonly string[]): boolean => {
  const first = section.firstSentence;
  return first !== undefined && handsOver(first.text, doc.source.slice(first.span.end, section.span.end), phrases);
};

/** 見出しとの重なりを測る文。用語集や表記の手引きは見出しの語の別の書き方を引用する（Not “datacentre”）ので、それは数えない。 */
const echoedText = (section: Section): string => withoutQuotedVariants(section.firstSentence?.text ?? "", section.heading);

export const headingEcho: Detector = (doc, options): Finding[] => {
  const leadIns = (doc.lexicons["lead-in"] ?? []).map((entry) => entry.pattern);
  return doc.sections
    .filter((section) => section.heading.length > 0 && section.firstSentence !== undefined && addsLittle(section, doc.lengthUnit))
    .filter((section) => !leadsIn(doc, section, leadIns))
    .map((section) => ({ section, overlap: Math.round(containment(trigrams(measuredHeading(section)), trigrams(echoedText(section))) * 100) }))
    .filter(({ overlap }) => overlap >= options.limit)
    .map(({ section, overlap }) => ({
      rule: "heading-echo",
      severity: "warning",
      line: 0,
      column: 0,
      quote: section.firstSentence?.text.trim() ?? "",
      values: { heading: section.heading, count: overlap, limit: options.limit, offset: section.firstSentence?.span.start ?? section.span.start },
    }));
};
