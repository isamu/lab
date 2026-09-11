import type { ProseDocument, Section } from "./plugin.ts";

/**
 * 二段構えの 1 段目。文書全体を LLM に投げない。spec §14。
 *
 * 絞り込みを持たない L4 rule は登録できない。持たせないと、1 記事ごとに全文を
 * 読ませることになり、速度もコストも成り立たない。
 */
export type Candidate = { readonly text: string; readonly offset: number };

export type Filter = (doc: ProseDocument) => Candidate[];

const heads = (doc: ProseDocument): string => doc.sections.map((section) => section.heading).join(" ");

const sectionText = (doc: ProseDocument, section: Section): string => doc.source.slice(section.span.start, section.span.end).trim();

/** 見出しに答えが書いてあるなら、本文を読ませる必要はない。 */
const skipIfHeadingMatches = (doc: ProseDocument, pattern: RegExp): boolean => pattern.test(heads(doc));

const RISK_HEADING = /リスク|懸念|デメリット|risk|tradeoff|downside/iu;

/** 提案文書にリスクが書かれているか。見出しにあれば見ない。 */
export const riskDisclosure: Filter = (doc) => {
  if (skipIfHeadingMatches(doc, RISK_HEADING)) return [];
  const body = doc.sentences.map((sentence) => sentence.text.trim()).join("");
  if (body.length === 0) return [];
  return [{ text: body.slice(0, 4000), offset: doc.sentences[0]?.span.start ?? 0 }];
};

const EVIDENCE = /\d|`|https?:\/\//u;

/**
 * 結びが本文の要約でしかないか。
 * 最後の節だけを見て、そこに具体物が無いときにだけ問い合わせる。
 */
export const emptyConclusion: Filter = (doc) => {
  const last = doc.sections.at(-1);
  if (last === undefined || last.sentences.length === 0) return [];
  const text = sectionText(doc, last);
  if (EVIDENCE.test(text)) return [];
  return [{ text: text.slice(0, 2000), offset: last.sentences[0]?.span.start ?? last.span.start }];
};

// \s* を挟むとバックトラックする。単位の前の空白は 1 つまでで足りる。
const NUMBER = /\d ?(?:%|％|倍|割|件|人|円|ドル|時間|分|秒)/u;
const EFFECT = /向上|改善|削減|短縮|増加|減少|成長|伸び/u;
/**
 * 根拠と認めるもの。ここを狭く取ると、根拠つきの文まで LLM に送ってしまう。
 * 二段構えの 1 段目が防ぐべきなのは、まさにその無駄。
 */
const EVIDENCE_WORDS = ["出典", "調査", "自社調べ", "参考", "期間", "比較", "対比", "前年", "昨年", "同期", "前月", "前四半期", "vs"];
const EVIDENCE_SHAPE = /n ?=|\[\d+\]|\d{4} ?年|Q[1-4]/iu;

/** 語の照合は正規表現にしない。数が増えるほど式が読めなくなり、複雑度も上がる。 */
const hasEvidence = (text: string): boolean => EVIDENCE_WORDS.some((word) => text.includes(word)) || EVIDENCE_SHAPE.test(text);

/** 効果を主張する数値に根拠が無い文だけを渡す。 */
export const unsourcedNumber: Filter = (doc) =>
  doc.sentences
    .filter((sentence) => NUMBER.test(sentence.text) && EFFECT.test(sentence.text) && !hasEvidence(sentence.text))
    .map((sentence) => ({ text: sentence.text.trim(), offset: sentence.span.start }));

/** 利用者が checks.yaml に書いた検査の既定。絞り込みを書かなければ文書全体。 */
export const wholeDocument: Filter = (doc) => {
  const body = doc.sentences.map((sentence) => sentence.text.trim()).join("");
  return body.length === 0 ? [] : [{ text: body.slice(0, 4000), offset: doc.sentences[0]?.span.start ?? 0 }];
};

export const FILTERS: Readonly<Record<string, Filter>> = {
  "risk-disclosure": riskDisclosure,
  "empty-conclusion": emptyConclusion,
  "unsourced-number": unsourcedNumber,
  "whole-document": wholeDocument,
};
