import { charLength, proseText } from "../measure.ts";
import type { Detector, Finding, Section } from "../plugin.ts";
import { isQuotedMention } from "./bold-quoted.ts";

/** これより短い節では密度が暴れる。43 字に 1 箇所で「1000 字あたり 23」になる。 */
const MIN_CHARS = 200;

const PER = 1000;

const charsOf = (section: Section): number => section.sentences.reduce((sum, sentence) => sum + charLength(sentence), 0);

/** The section's bold runs, less those that only quote words: a README bolds the part of an example sentence it talks about. */
const boldsOf = (section: Section, source: string): number =>
  section.strongs === undefined ? section.strongCount : section.strongs.filter((span) => !isQuotedMention(source, span)).length;

/**
 * 節あたりの「密度」を見る。件数ではない。
 *
 * 件数で数えると、節が長いほど当たる。実文書で測ると、1095 字に 2 箇所の節と
 * 557 字に 9 箇所の節が同じ「多すぎる」になっていた。読者が受け取る印象は逆なのに。
 *
 * rule の名前（bold-density）が最初から密度と言っていた。件数で実装していたのが誤り。
 */
export const countPerSection: Detector = (doc, options): Finding[] =>
  doc.sections
    .map((section) => ({ section, chars: charsOf(section), bolds: boldsOf(section, doc.source) }))
    .filter(({ chars }) => chars >= MIN_CHARS)
    .map(({ section, chars, bolds }) => ({ section, chars, bolds, density: Math.round((bolds / chars) * PER) }))
    .filter(({ density }) => density > options.limit)
    .map(({ section, chars, bolds, density }) => ({
      rule: "bold-density",
      severity: "warning",
      line: 0,
      column: 0,
      // 節全体を引くと段落をまたいで読めなくなる。最初の文だけ見せて場所を示す。
      quote: section.firstSentence === undefined ? "" : proseText(section.firstSentence),
      values: {
        count: density,
        limit: options.limit,
        bolds,
        chars,
        offset: section.firstSentence?.span.start ?? section.span.start,
      },
    }));
