// @ts-check
// 契約書で、同じ当事者を 2 つの呼び方で混在して書いているときに指摘する。
// 「甲」と「委託者」、「乙」と「受託者」、「開示者」と「受領者」など、文書内で表記ゆれが起きると、
// 読み手は「甲 = 委託者」と逐一突き合わせることになる。契約書では当事者の表記は 1 つに固定するのが作法。

/** @import { Detector, Sentence } from "chaffjs/api" */

/** 契約書で現れがちな当事者ペア。片方の語が別の語で言い換えられていたら指摘する。 */
const PARTY_ALIAS_PAIRS = [
  { canonical: "甲", aliases: ["委託者", "発注者", "開示者", "ライセンサー", "甲社", "甲会社"] },
  { canonical: "乙", aliases: ["受託者", "受注者", "受領者", "ライセンシー", "乙社", "乙会社"] },
  { canonical: "開示者", aliases: ["ディスクロージャー"] },
  { canonical: "受領者", aliases: ["レシピエント"] },
];

/**
 * @param {Sentence} sentence
 * @param {string} pattern
 */
const occurrencesIn = (sentence, pattern) => {
  const spans = [];
  let idx = 0;
  while (true) {
    const at = sentence.text.indexOf(pattern, idx);
    if (at === -1) break;
    spans.push({ start: sentence.span.start + at, end: sentence.span.start + at + pattern.length });
    idx = at + pattern.length;
  }
  return spans;
};

/**
 * ドキュメント全体で、canonical と alias の両方が使われているペアを見つける。
 * @param {{ sentences: Sentence[] }} doc
 */
const findMixedPairs = (doc) => {
  const findings = [];
  for (const pair of PARTY_ALIAS_PAIRS) {
    const canonicalSpans = doc.sentences.flatMap((s) => occurrencesIn(s, pair.canonical));
    if (canonicalSpans.length === 0) continue;
    for (const alias of pair.aliases) {
      const aliasSpans = doc.sentences.flatMap((s) => occurrencesIn(s, alias));
      if (aliasSpans.length === 0) continue;
      // 両方現れた → alias 側を全部指摘（canonical に寄せる想定）
      for (const span of aliasSpans) {
        findings.push({ ...span, values: { canonical: pair.canonical, alias } });
      }
    }
  }
  return findings;
};

/** @type {Detector} */
export const partyAliasMix = (doc) => findMixedPairs(doc);

export const PARTY_ALIAS_MIX = {
  id: "party-alias-mix",
  level: "warning",
  name: {
    ja: "当事者の呼び方が混ざっている",
    en: "Party alias mixed with its canonical form",
  },
  why: {
    ja: "契約書で同じ当事者を 2 つの呼び方（「甲」と「委託者」など）で書くと、読み手は毎回対応を突き合わせることになります。当事者の表記は文書内で 1 つに固定します。",
    en: "A contract that refers to the same party by two names (e.g. 甲 and 委託者) forces the reader to map them each time. Pick one and use it throughout.",
  },
  message: {
    ja: "「{alias}」と書いていますが、文書内では「{canonical}」も使われています。どちらかに統一してください。",
    en: 'Written as "{alias}" but the document also uses "{canonical}". Pick one.',
  },
  how_to_fix: {
    ja: "文書内の当事者表記を「甲／乙」か「委託者／受託者」のどちらかに統一します。",
    en: "Unify the party terms either to 甲／乙 or to the role names (委託者／受託者 etc.) throughout.",
  },
  example: {
    before: {
      ja: "甲は乙に業務を委託する。委託者は受託者に対して報告を求めることができる。",
      en: "The Transferor shall assign to the Recipient. The Discloser may request a report from the Receiver.",
    },
    after: {
      ja: "甲は乙に業務を委託する。甲は乙に対して報告を求めることができる。",
      en: "The Transferor shall assign to the Recipient. The Transferor may request a report from the Recipient.",
    },
  },
  use_for: ["legal/contract"],
};
