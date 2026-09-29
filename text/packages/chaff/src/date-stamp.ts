import type { Span } from "./plugin.ts";

/** 段落 1 つ。dates は段落の中の日付の位置で、段落の先頭から数える。 */
export type StampCandidate = { readonly text: string; readonly dates: readonly Span[] };

/** 段落ごとの候補。dates は文書の中の日付の位置で、段落の中にすっかり収まるものだけを段落の先頭からの位置にする。 */
export const stampCandidates = (source: string, paragraphs: readonly Span[], dates: readonly Span[]): StampCandidate[] =>
  paragraphs.map((paragraph) => ({
    text: source.slice(paragraph.start, paragraph.end),
    dates: dates
      .filter((date) => date.start >= paragraph.start && date.end <= paragraph.end)
      .map((date) => ({ start: date.start - paragraph.start, end: date.end - paragraph.start })),
  }));

/** 文字か数字。日付を除いてこれが 1 つも残らなければ、日付だけの段落。 */
const WORD = /[\p{L}\p{N}]/u;
const ENDS_WITH_COLON = /[:：]\s*$/u;
const LABEL_EDGE = /[\s:：]/u;

/** 幅の無い日付は日付として読まない。段落が日付だけかどうかを、何も覆わない位置で決めない。 */
const datesOf = (candidate: StampCandidate): Span[] => candidate.dates.filter((date) => date.end > date.start);

const withoutDates = (candidate: StampCandidate): string => {
  const ordered = datesOf(candidate).sort((left, right) => left.start - right.start);
  const gaps = ordered.reduce<{ readonly parts: readonly string[]; readonly from: number }>(
    (acc, date) => ({ parts: [...acc.parts, candidate.text.slice(acc.from, date.start)], from: Math.max(acc.from, date.end) }),
    { parts: [], from: 0 },
  );
  return [...gaps.parts, candidate.text.slice(gaps.from)].join(" ");
};

/** 前後の空白とコロンを外したラベル。「Last updated:」も「：最終更新日」も同じ語として引く。 */
const bareLabel = (text: string): string => {
  const chars = [...text];
  const first = chars.findIndex((char) => !LABEL_EDGE.test(char));
  const last = chars.findLastIndex((char) => !LABEL_EDGE.test(char));
  return first === -1 ? "" : chars.slice(first, last + 1).join("");
};

const isLabel = (text: string, labels: readonly string[]): boolean => {
  const bare = bareLabel(text).toLowerCase();
  return bare !== "" && labels.some((label) => label.toLowerCase() === bare);
};

const isDateOnly = (candidate: StampCandidate | undefined): boolean =>
  candidate !== undefined && datesOf(candidate).length > 0 && !WORD.test(withoutDates(candidate));

/** 「Updated 2026-03-03」「最終更新日：2025年6月20日」。日付を除くと、語彙表のラベルしか残らない。 */
const isLabelledDate = (candidate: StampCandidate, labels: readonly string[]): boolean =>
  datesOf(candidate).length > 0 && isLabel(withoutDates(candidate), labels);

/** 「最終更新日:」の段落のすぐ後に日付だけの段落。Web ページを写すと、ラベルと日付が別の段落に割れる。 */
const isLabelBeforeDate = (candidate: StampCandidate, next: StampCandidate | undefined, labels: readonly string[]): boolean =>
  ENDS_WITH_COLON.test(candidate.text) && isLabel(candidate.text, labels) && isDateOnly(next);

/**
 * 更新日・公開日の刻印になっている段落の位置。ページの付帯情報で、書いた人が読み手に読ませる前置きではない。
 * ラベルの語は言語パッケージの語彙表（date-stamp-label）から渡す。文の中に日付があるだけの段落は刻印ではない。
 */
export const dateStampIndexes = (candidates: readonly StampCandidate[], labels: readonly string[]): ReadonlySet<number> =>
  new Set(
    candidates.flatMap((candidate, index) =>
      isDateOnly(candidate) || isLabelledDate(candidate, labels) || isLabelBeforeDate(candidate, candidates[index + 1], labels) ? [index] : [],
    ),
  );
