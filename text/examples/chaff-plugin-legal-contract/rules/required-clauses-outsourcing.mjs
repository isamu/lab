// @ts-check
// 業務委託契約書で、通常入っているはずの条項が入っていない場合に指摘する。

/** @import { Detector, RuleDocument } from "chaffjs/api" */

/** 業務委託契約書の必須条項。文書内に「このどれかの語」があれば条項は存在すると判定する。 */
const REQUIRED_OUTSOURCING_CLAUSES = [
  {
    id: "scope-of-work",
    name: "業務内容",
    keywords: ["業務の内容", "委託業務", "本件業務", "本業務の内容", "業務内容は"],
  },
  {
    id: "fee",
    name: "委託料",
    keywords: ["委託料", "業務委託料", "報酬", "本件業務の対価"],
  },
  {
    id: "payment-terms",
    name: "支払条件",
    keywords: ["支払う", "支払方法", "支払期日", "振込", "請求書"],
  },
  {
    id: "deadline-or-term",
    name: "納期または契約期間",
    keywords: ["納期", "履行期限", "業務の期間", "契約期間", "本契約の有効期間"],
  },
  {
    id: "deliverables",
    name: "成果物の定義",
    keywords: ["成果物", "納品物", "納入", "引き渡す", "引渡し"],
  },
  {
    id: "ip-rights",
    name: "著作権の帰属",
    keywords: ["著作権", "知的財産権", "成果物の権利", "権利の帰属"],
  },
  {
    id: "subcontracting",
    name: "再委託の可否",
    keywords: ["再委託", "第三者に委託", "下請け"],
  },
  {
    id: "warranty",
    name: "契約不適合責任（瑕疵担保）",
    keywords: ["契約不適合", "瑕疵", "欠陥", "不具合", "品質保証"],
  },
  {
    id: "reporting",
    name: "報告義務",
    keywords: ["報告", "進捗", "業務の状況"],
  },
  {
    id: "termination",
    name: "契約解除",
    keywords: ["本契約を解除", "契約を解除", "解除することができる", "解除する"],
  },
  {
    id: "damages",
    name: "損害賠償",
    keywords: ["損害賠償", "損害を賠償", "損害の賠償"],
  },
  {
    id: "confidentiality",
    name: "秘密保持",
    keywords: ["秘密保持", "秘密情報", "機密", "守秘"],
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
  return REQUIRED_OUTSOURCING_CLAUSES.filter((clause) => !clause.keywords.some((kw) => text.includes(kw))).map((clause) => {
    const firstSentence = doc.sentences[0];
    return {
      start: firstSentence?.span.start ?? 0,
      end: firstSentence?.span.end ?? 0,
      values: { missingClause: clause.name, clauseId: clause.id },
    };
  });
};

/** @type {Detector} */
export const requiredClausesOutsourcing = (doc) => findMissingClauses(doc);

export const REQUIRED_CLAUSES_OUTSOURCING = {
  id: "required-clauses-outsourcing",
  level: "warning",
  name: {
    ja: "業務委託契約書で欠けている必須条項",
    en: "Required clause missing in outsourcing agreement",
  },
  why: {
    ja: "業務委託契約書で通常入っている条項（業務内容・委託料・支払条件・納期・成果物・著作権帰属・再委託・契約不適合責任・報告義務・契約解除・損害賠償・秘密保持・準拠法・合意管轄）が欠けていると、紛争が起きたときに責任分担が決まりません。欠けているものは意図して外したのか、入れ忘れたのかを確認してください。",
    en: "An outsourcing agreement that misses one of its usual clauses (scope, fee, payment terms, deadline, deliverables, IP rights, subcontracting, warranty, reporting, termination, damages, confidentiality, governing law, jurisdiction) will not divide responsibility when a dispute arises.",
  },
  message: {
    ja: "この業務委託契約書には「{missingClause}」に関する条項が見当たりません。",
    en: 'No clause for "{missingClause}" is found in this outsourcing agreement.',
  },
  how_to_fix: {
    ja: "必要な条項を追加してください。意図的に外している場合は、`<!-- stet: legal-contract/required-clauses-outsourcing — 理由 -->` で黙らせてください。",
    en: "Add the missing clause, or silence this rule locally with a stet comment if omitted on purpose.",
  },
  example: {
    before: {
      ja: "著作権の帰属条項のない業務委託契約書（成果物の権利がどちらに帰属するか決まらない）",
      en: "An outsourcing agreement with no IP-rights clause (ownership of deliverables is unclear)",
    },
    after: {
      ja: "本件業務の成果物に係る著作権は、委託料の支払完了時に乙から甲へ譲渡される。",
      en: "The copyright in the deliverables transfers from Party B to Party A upon full payment of the fee.",
    },
  },
  use_for: ["legal/contract"],
};
