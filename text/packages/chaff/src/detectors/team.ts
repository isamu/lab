import { proseText } from "../measure.ts";
import { wordsOf } from "./structure.ts";
import type { Detector, Finding, Sentence, Token } from "../plugin.ts";

/**
 * チームの言葉。社内でしか通じない語を、チームが chaff.yaml に自分で並べる。
 *
 * 何が社内用語かは組織ごとに違うので、chaff は語を持たない。並べる場所だけを用意する。
 * 語彙表が空なら何も言わない（「用語を登録してください」とも言わない。押しつけない）。
 */
/**
 * 表層でも原形でも当てる。利用者は辞書形で書く（「握る」）が、本文は活用している（「握った」）。
 * 品詞解析があれば原形で当たり、無くても表層で当たる。要求はしない。
 */
const matches = (sentence: Sentence, word: string): boolean => sentence.text.includes(word) || (sentence.tokens ?? []).some((token) => token.lemma === word);

export const internalJargon: Detector = (doc, options): Finding[] => {
  const words = (options.lexicon ?? []).map((entry) => entry.pattern);
  if (words.length === 0) return [];
  const hits = doc.sentences.flatMap((sentence) => {
    const matched = words.find((word) => matches(sentence, word));
    return matched === undefined ? [] : [{ sentence, matched }];
  });
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "internal-jargon",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};

const has = (headings: readonly string[], wanted: string): boolean => headings.some((heading) => heading.includes(wanted));

/**
 * この種類の文書に無いと困る見出し。チームが chaff.yaml で決める。
 *
 * 「提案書にはリスクの節がある」のような取り決めは、組織ごとに違う。
 * chaff は必須の見出しを持たず、**書かれた取り決めを守れているかだけ**を見る。
 */
export const requiredSections: Detector = (doc, options): Finding[] => {
  const wanted = doc.requiredSections;
  if (wanted.length === 0) return [];
  const headings = doc.sections.map((section) => section.heading);
  const missing = wanted.filter((name) => !has(headings, name));
  if (missing.length < options.limit) return [];
  return [
    {
      rule: "required-sections",
      severity: "error",
      line: 0,
      column: 0,
      quote: headings.filter((heading) => heading.length > 0).join(" / "),
      values: { word: missing.join("、"), count: missing.length, limit: options.limit, offset: 0 },
    },
  ];
};

const PER = 1000;

/** 密度を見る rule は短い文書を測らない。単位は言語で違うので床も分ける。 */
const FLOOR = { word: 200, char: 500 };

const isProperNoun = (token: Token): boolean => token.pos === "PROPN";

/**
 * 固有名詞の密度。製品名・社名・人名が続くと、知らない読者は文の骨組みを見失う。
 *
 * spec は未知語率としていたが、**品詞解析があれば PROPN を数えるだけで足りる**。
 * 辞書を別に持つ必要はない。
 */
export const properNounDensity: Detector = (doc, options): Finding[] => {
  const hits = doc.sentences.flatMap((sentence) => (sentence.tokens ?? []).filter(isProperNoun).map((token) => ({ sentence, token })));
  const length = wordsOf(doc);
  const rate = length === 0 ? 0 : Math.round((hits.length / length) * PER);
  const first = hits[0];
  if (length < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
  return [
    {
      rule: "proper-noun-density",
      severity: "info",
      line: 0,
      column: 0,
      quote: proseText(first.sentence),
      values: { count: hits.length, density: rate, limit: options.limit, offset: first.token.span.start },
    },
  ];
};
