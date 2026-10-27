import { proseText } from "../measure.ts";
import type { Detector, Finding, ProseDocument, Section, Sentence } from "../plugin.ts";
import {
  evidenceSpans,
  hasNumeral,
  isClaim,
  isConditionHeading,
  isLabelOnly,
  isNavigationLine,
  startsWithin,
  statesIntent,
  type AdviceWords,
  type IntentWords,
} from "./concrete-evidence.ts";
import { letteredIndexEntries } from "./lettered-index.ts";

/**
 * 具体物の密度。数値・コード・リンク・引用が 1 つも無い節は、
 * 読み終えても何も持ち帰れない。**少ないほうを指摘する**ので、他の密度 rule と向きが逆。
 */
const CONCRETE = /\d|`|https?:\/\//u;

/**
 * 見出しのない導入部は、書き出しで呼ぶ。文書の言葉なので、message がどの言語でも混ざらない。
 * 決まった呼び名（「この節」）を置くと、英語の文書の message に日本語が入る。
 */
const OPENING = { word: 4, char: 12 };

const openingOf = (sentence: Sentence | undefined, unit: ProseDocument["lengthUnit"]): string => {
  const text = sentence === undefined ? "" : proseText(sentence);
  const pieces = unit === "word" ? text.split(" ") : Array.from(text);
  const joiner = unit === "word" ? " " : "";
  return pieces.length <= OPENING[unit] ? pieces.join(joiner) : `${pieces.slice(0, OPENING[unit]).join(joiner)}…`;
};

const hasNumeralIn = (section: Section): boolean => section.sentences.some((sentence) => hasNumeral(sentence.tokens ?? []));

/** これより短い節は、具体物があるべきか判断できない。 */
const MIN_SENTENCES = 3;

const adviceWordsOf = (doc: ProseDocument): AdviceWords => ({
  openers: (doc.lexicons["advice-opener"] ?? []).map((entry) => entry.pattern),
  endings: (doc.lexicons["advice-ending"] ?? []).map((entry) => entry.pattern),
});

const intentWordsOf = (doc: ProseDocument): IntentWords => ({
  phrases: (doc.lexicons["intent-phrase"] ?? []).map((entry) => entry.pattern),
  endings: (doc.lexicons["intent-ending"] ?? []).map((entry) => entry.pattern),
});

const lowerPatternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern.toLowerCase());

/**
 * 文の半分以上が問い・指示・見込みや方針の節（質問の一覧、手引き、リスクと対策、答申の提言）は、数字で裏づける主張をしていない。
 * 番号だけの文（a.）は数えない。
 */
const mostlyClaims = (sentences: readonly Sentence[], language: string, advice: AdviceWords, intent: IntentWords): boolean => {
  const said = sentences.filter((sentence) => !isLabelOnly(sentence));
  return said.filter((sentence) => isClaim(sentence, language, advice) && !statesIntent(sentence, intent)).length * 2 > said.length;
};

export const concreteEvidence: Detector = (doc, options): Finding[] => {
  const entries = letteredIndexEntries(doc.sections);
  const advice = adviceWordsOf(doc);
  const intent = intentWordsOf(doc);
  const navigation = lowerPatternsOf(doc, "navigation-line");
  const conditionHeadings = lowerPatternsOf(doc, "condition-heading");
  const proseOf = (section: Section): Sentence[] => section.sentences.filter((sentence) => !isNavigationLine(sentence, navigation));
  const sections = doc.sections.filter((section) => {
    const sentences = proseOf(section);
    return (
      sentences.length >= MIN_SENTENCES &&
      !entries.has(section) &&
      !isConditionHeading(section.unlabeledHeading ?? section.heading, conditionHeadings) &&
      mostlyClaims(sentences, doc.language, advice, intent)
    );
  });
  const bare = sections.filter(
    (section) => !CONCRETE.test(doc.source.slice(section.span.start, section.span.end)) && !hasNumeralIn(section) && !startsWithin(section.span, doc.links),
  );
  // 構造の木は作るのに手間がかかる。指摘に届かない文書では作らない。
  const nodes = bare.length < options.limit ? [] : evidenceSpans(doc.structure);
  const empty = bare.filter((section) => !startsWithin(section.span, nodes));
  if (empty.length < options.limit) return [];
  return empty.map((section) => ({
    rule: "concrete-evidence-density",
    severity: "info",
    line: 0,
    column: 0,
    quote: section.heading.length > 0 ? section.heading : (section.sentences[0]?.text.trim() ?? ""),
    values: {
      word: section.heading.length > 0 ? section.heading : openingOf(section.sentences[0], doc.lengthUnit),
      count: empty.length,
      total: sections.length,
      limit: options.limit,
      offset: section.span.start,
    },
  }));
};
