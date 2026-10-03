// @ts-check
// 利用規約で、通常入っているはずの条項が入っていない場合に指摘する。

/** @import { Detector, RuleDocument } from "chaffjs/api" */

/** 利用規約の必須条項。 */
const REQUIRED_TOS_CLAUSES = [
  {
    id: "scope",
    name: "本規約の適用範囲",
    keywords: ["本規約の適用", "本規約が適用", "本規約は", "適用範囲"],
  },
  {
    id: "definitions",
    name: "定義",
    keywords: ["本規約において", "本規約における", "次の各号に定める", "次の意味を有する", "定義とする"],
  },
  {
    id: "service-description",
    name: "サービス内容",
    keywords: ["本サービスの内容", "本サービスは", "サービス内容", "提供するサービス"],
  },
  {
    id: "membership-registration",
    name: "会員登録・利用申込",
    keywords: ["利用登録", "会員登録", "利用申込", "アカウント", "登録情報"],
  },
  {
    id: "prohibited-acts",
    name: "禁止事項",
    keywords: ["禁止事項", "次の行為を禁止", "次の各号に該当する行為"],
  },
  {
    id: "fees",
    name: "利用料金",
    keywords: ["利用料金", "料金", "支払う", "対価", "無料で", "有料"],
  },
  {
    id: "service-termination",
    name: "サービスの変更・中止",
    keywords: ["サービスの変更", "サービスの中止", "サービスの終了", "サービスを変更", "サービスを中止", "サービスを終了"],
  },
  {
    id: "disclaimer",
    name: "免責事項",
    keywords: ["免責", "責任を負わない", "責任を負いません", "一切の責任を負わない"],
  },
  {
    id: "amendments",
    name: "規約の変更",
    keywords: ["本規約の変更", "本規約を変更", "規約を改定", "規約の改定"],
  },
  {
    id: "intellectual-property",
    name: "知的財産権",
    keywords: ["著作権", "知的財産権", "商標"],
  },
  {
    id: "personal-info-handling",
    name: "個人情報の取扱い",
    keywords: ["個人情報", "プライバシーポリシー", "プライバシー・ポリシー"],
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
  return REQUIRED_TOS_CLAUSES.filter((clause) => !clause.keywords.some((kw) => text.includes(kw))).map((clause) => {
    const firstSentence = doc.sentences[0];
    return {
      start: firstSentence?.span.start ?? 0,
      end: firstSentence?.span.end ?? 0,
      values: { missingClause: clause.name, clauseId: clause.id },
    };
  });
};

/** @type {Detector} */
export const requiredClausesTos = (doc) => findMissingClauses(doc);

export const REQUIRED_CLAUSES_TOS = {
  id: "required-clauses-tos",
  level: "warning",
  name: {
    ja: "利用規約で欠けている必須条項",
    en: "Required clause missing in terms of service",
  },
  why: {
    ja: "利用規約で通常入っている条項（適用範囲・定義・サービス内容・会員登録・禁止事項・利用料金・サービス変更中止・免責・規約変更・知的財産権・個人情報取扱い・準拠法・合意管轄）が欠けていると、消費者契約法や特定商取引法との関係で無効と判断されるリスクがあります。",
    en: "A terms-of-service document missing one of its usual clauses (scope, definitions, service description, membership, prohibited acts, fees, service changes, disclaimer, amendments, IP rights, personal info, governing law, jurisdiction) risks being found invalid under the Consumer Contract Act or related laws.",
  },
  message: {
    ja: "この利用規約には「{missingClause}」に関する条項が見当たりません。",
    en: 'No clause for "{missingClause}" is found in these terms of service.',
  },
  how_to_fix: {
    ja: "必要な条項を追加してください。意図的に外している場合は、`<!-- stet: legal-contract/required-clauses-tos — 理由 -->` で黙らせてください。",
    en: "Add the missing clause, or silence this rule locally with a stet comment if omitted on purpose.",
  },
  example: {
    before: {
      ja: "禁止事項の条項がない利用規約（ユーザーがどこまで何をしていいか不明）",
      en: "A ToS with no prohibited-acts clause (unclear what users may do)",
    },
    after: {
      ja: "ユーザーは、本サービスの利用にあたり、以下の行為を行ってはならない。(1) 法令または公序良俗に違反する行為 (2) 犯罪行為に関連する行為 ...",
      en: "The User must not engage in the following acts when using this Service: (1) acts violating laws or public order (2) acts related to criminal activity ...",
    },
  },
  use_for: ["legal/contract"],
};
