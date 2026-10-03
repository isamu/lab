// @ts-check
// 契約書で頻出する「〜ものとする」のうち、「〜する」で済むものを指摘する。
// 「〜ものとする」は本来、法令で「みなす」に近い意味を持たせる書き方だが、現代の契約書では
// 単なる語尾の飾りとして使われていることが多い。削って「〜する」にしても意味が変わらない箇所は冗長。

/** @import { Detector, Sentence } from "chaffjs/api" */

/**
 * 「〜ものとする」が末尾付近に出てきて、かつその前が動詞の終止形っぽい場合、冗長の候補。
 * 完全な判定は難しいので、頻出パターンだけ拾う（過検出より見逃し寄りに倒す）。
 */
const PATTERN = /([ぁ-んァ-ヶ一-龠々]+(?:する|できる|負う|有する|とる|行う|課する|定める))ものとする/g;

/**
 * @param {Sentence} sentence
 */
const occurrencesIn = (sentence) => {
  return [...sentence.text.matchAll(PATTERN)].map((match) => ({
    start: sentence.span.start + (match.index ?? 0),
    end: sentence.span.start + (match.index ?? 0) + match[0].length,
    values: { stem: match[1] },
  }));
};

/** @type {Detector} */
export const monoToSuruFiller = (doc) => doc.sentences.flatMap(occurrencesIn);

export const MONO_TO_SURU_FILLER = {
  id: "mono-to-suru-filler",
  level: "info",
  name: {
    ja: "「〜ものとする」が「〜する」で足りる",
    en: "Redundant 「〜ものとする」",
  },
  why: {
    ja: "「〜ものとする」は本来、法令で「〜とみなす」に近い意味を持たせるための書き方です。現代の契約書では単なる語尾として使われていることが多く、「〜する」に置き換えても意味が変わりません。意図があって使っている箇所以外は、短い形に整えると読み手が楽になります。",
    en: "「ものとする」historically carries a 'shall be deemed' nuance from statutes. In modern contracts it is often used as a stylistic ending that can be replaced by 「する」 without changing the meaning.",
  },
  message: {
    ja: '「{stem}ものとする」は「{stem}」で足りる可能性があります。意図して「ものとする」の含みを持たせているなら残してください。',
    en: 'Consider「{stem}」instead of「{stem}ものとする」unless the 「ものとする」 nuance is intended.',
  },
  how_to_fix: {
    ja: "「〜ものとする」を「〜する」に差し替えて読み直し、意味が変わらなければそのまま。意味が変わるなら残します。",
    en: "Replace 「ものとする」 with the plain verb and re-read; keep it only if the meaning shifts.",
  },
  example: {
    before: {
      ja: "甲は、乙に対し、業務の進捗状況を毎月報告するものとする。",
      en: "The Party A shall provide the Party B with a monthly progress report (nuance of shall be deemed).",
    },
    after: {
      ja: "甲は、乙に対し、業務の進捗状況を毎月報告する。",
      en: "The Party A provides the Party B with a monthly progress report.",
    },
  },
  use_for: ["legal/contract"],
};
