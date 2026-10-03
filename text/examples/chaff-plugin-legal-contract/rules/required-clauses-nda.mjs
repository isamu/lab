// @ts-check
// NDA（秘密保持契約）で、通常入っているはずの条項が入っていない場合に指摘する。
// 契約書は条番号つきの木構造として chaff が読めるので、文書全体を走査して「このキーワード群が
// どこにも出てこないなら、この条項が欠落している」と判定する。

/** @import { Detector, RuleDocument } from "chaffjs/api" */

/**
 * NDA の必須条項。それぞれ、文書内に「このどれかの語」があれば条項は存在すると判定する。
 * 複数のキーワードは OR の関係（どれか 1 つあれば OK）。
 */
const REQUIRED_NDA_CLAUSES = [
  {
    id: "definition-of-confidential-info",
    name: "秘密情報の定義",
    keywords: ["秘密情報とは", "秘密情報を次のとおり", "本契約において「秘密情報」", "「秘密情報」とは"],
  },
  {
    id: "purpose-of-use",
    name: "使用目的の制限",
    keywords: ["使用目的", "本目的", "本件目的", "のみに使用", "のためにのみ"],
  },
  {
    id: "no-disclosure-to-third-party",
    name: "第三者への開示禁止",
    keywords: ["第三者に開示", "第三者に対して開示", "第三者に漏洩", "第三者に提供"],
  },
  {
    id: "return-or-destruction",
    name: "秘密情報の返還・廃棄",
    keywords: ["返還", "破棄", "廃棄", "消去"],
  },
  {
    id: "term-of-agreement",
    name: "契約期間",
    keywords: ["本契約の有効期間", "契約期間", "有効期間", "期間は"],
  },
  {
    id: "survival",
    name: "存続条項（契約終了後も秘密保持義務が残る）",
    keywords: ["契約終了後", "契約の終了後", "本契約が終了した後", "終了後も", "終了した後も"],
  },
  {
    id: "damages",
    name: "損害賠償",
    keywords: ["損害賠償", "損害を賠償", "損害の賠償"],
  },
  {
    id: "governing-law",
    name: "準拠法",
    keywords: ["準拠法", "日本法に", "日本国法に"],
  },
  {
    id: "jurisdiction",
    name: "合意管轄",
    keywords: ["専属的合意管轄", "専属管轄", "合意管轄裁判所", "第一審の管轄"],
  },
];

/**
 * @param {RuleDocument} doc
 */
const findMissingClauses = (doc) => {
  const text = doc.source;
  return REQUIRED_NDA_CLAUSES.filter((clause) => !clause.keywords.some((kw) => text.includes(kw))).map((clause) => {
    // 文書の冒頭に指摘を出す（具体的な行はない）
    const firstSentence = doc.sentences[0];
    return {
      start: firstSentence?.span.start ?? 0,
      end: firstSentence?.span.end ?? 0,
      values: { missingClause: clause.name, clauseId: clause.id },
    };
  });
};

/** @type {Detector} */
export const requiredClausesNda = (doc) => findMissingClauses(doc);

export const REQUIRED_CLAUSES_NDA = {
  id: "required-clauses-nda",
  level: "warning",
  name: {
    ja: "NDA で欠けている必須条項",
    en: "Required clause missing in NDA",
  },
  why: {
    ja: "NDA で通常入っている条項（秘密情報の定義・使用目的・第三者開示禁止・返還廃棄・期間・存続・損害賠償・準拠法・合意管轄）が欠けていると、万一のとき契約として機能しません。欠けているものは意図して外したのか、入れ忘れたのかを確認してください。",
    en: "An NDA that misses one of its usual clauses (definition of confidential information, purpose, no third-party disclosure, return/destruction, term, survival, damages, governing law, jurisdiction) may not hold up. Check whether it was omitted on purpose.",
  },
  message: {
    ja: "この NDA には「{missingClause}」に関する条項が見当たりません。",
    en: 'No clause for "{missingClause}" is found in this NDA.',
  },
  how_to_fix: {
    ja: "必要な条項を追加してください。意図的に外している場合は、`<!-- stet: legal-contract/required-clauses-nda — 理由 -->` で黙らせてください。",
    en: "Add the missing clause, or silence this rule locally with a stet comment if omitted on purpose.",
  },
  example: {
    before: {
      ja: "準拠法条項のない NDA（紛争時にどの国の法で解釈するか決まらない）",
      en: "An NDA with no governing-law clause (unclear which law interprets a dispute)",
    },
    after: {
      ja: "本契約は日本法に準拠し、これに従って解釈される。",
      en: "This Agreement is governed by and construed in accordance with the laws of Japan.",
    },
  },
  use_for: ["legal/contract"],
};
