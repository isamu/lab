// @ts-check
// プライバシーポリシーで、個人情報保護法が要求する必須記載事項が入っていない場合に指摘する。

/** @import { Detector, RuleDocument } from "chaffjs/api" */

/** プライバシーポリシーの必須条項（個人情報保護法第 32 条の通知事項 + 一般慣行） */
const REQUIRED_PRIVACY_CLAUSES = [
  {
    id: "controller-info",
    name: "個人情報取扱事業者の名称・住所",
    keywords: ["個人情報取扱事業者", "事業者の名称", "当社の名称", "住所"],
  },
  {
    id: "categories-collected",
    name: "取得する個人情報の種類",
    keywords: ["取得する個人情報", "取得する情報", "収集する情報", "収集する個人情報", "次の個人情報を取得"],
  },
  {
    id: "purposes-of-use",
    name: "利用目的",
    keywords: ["利用目的", "利用の目的", "次の目的で", "以下の目的で"],
  },
  {
    id: "third-party-disclosure",
    name: "第三者提供",
    keywords: ["第三者提供", "第三者に提供", "第三者への提供"],
  },
  {
    id: "entrustment",
    name: "業務委託先への提供",
    keywords: ["業務委託", "委託先", "業務の委託"],
  },
  {
    id: "retention",
    name: "個人情報の保有期間",
    keywords: ["保有期間", "保管期間", "保存期間", "期間が経過", "期間経過後"],
  },
  {
    id: "security-measures",
    name: "安全管理措置",
    keywords: ["安全管理措置", "安全管理のための措置", "セキュリティ", "情報の保護"],
  },
  {
    id: "data-subject-rights",
    name: "開示・訂正・削除請求",
    keywords: ["開示請求", "開示を請求", "訂正", "削除を請求", "利用停止", "本人の請求"],
  },
  {
    id: "cross-border-transfer",
    name: "外国への移転",
    keywords: ["外国にある第三者", "外国への移転", "国外", "外国に所在"],
  },
  {
    id: "cookie-usage",
    name: "Cookie 等の利用",
    keywords: ["Cookie", "クッキー", "cookie", "個人関連情報"],
  },
  {
    id: "contact-point",
    name: "問い合わせ窓口",
    keywords: ["お問い合わせ", "問い合わせ窓口", "連絡先", "お問合せ"],
  },
  {
    id: "policy-changes",
    name: "プライバシーポリシーの変更",
    keywords: ["本ポリシーの変更", "本ポリシーを変更", "ポリシーの改定", "本ポリシーの改訂"],
  },
];

/**
 * @param {RuleDocument} doc
 */
const findMissingClauses = (doc) => {
  const text = doc.source;
  return REQUIRED_PRIVACY_CLAUSES.filter((clause) => !clause.keywords.some((kw) => text.includes(kw))).map((clause) => {
    const firstSentence = doc.sentences[0];
    return {
      start: firstSentence?.span.start ?? 0,
      end: firstSentence?.span.end ?? 0,
      values: { missingClause: clause.name, clauseId: clause.id },
    };
  });
};

/** @type {Detector} */
export const requiredClausesPrivacy = (doc) => findMissingClauses(doc);

export const REQUIRED_CLAUSES_PRIVACY = {
  id: "required-clauses-privacy",
  level: "warning",
  name: {
    ja: "プライバシーポリシーで欠けている必須記載事項",
    en: "Required item missing in privacy policy",
  },
  why: {
    ja: "個人情報保護法では、個人情報取扱事業者に対して、取得する個人情報の種類、利用目的、第三者提供、委託先、保有期間、安全管理措置、開示訂正削除請求への対応、外国への移転、問い合わせ窓口などの通知を義務付けています。これらが欠けていると、個人情報保護委員会からの指導対象になります。",
    en: "Japan's Act on the Protection of Personal Information requires controllers to publish categories collected, purposes, third-party disclosure, entrustment, retention, security measures, data-subject rights, cross-border transfer, and a contact point. Missing items may draw regulatory attention.",
  },
  message: {
    ja: "このプライバシーポリシーには「{missingClause}」に関する記載が見当たりません。",
    en: 'No item for "{missingClause}" is found in this privacy policy.',
  },
  how_to_fix: {
    ja: "必要な記載を追加してください。意図的に外している場合は、`<!-- stet: legal-contract/required-clauses-privacy — 理由 -->` で黙らせてください。",
    en: "Add the missing item, or silence this rule locally with a stet comment if omitted on purpose.",
  },
  example: {
    before: {
      ja: "開示請求に関する記載がないプライバシーポリシー（本人が自分の個人情報を確認する方法が示されていない）",
      en: "A privacy policy with no data-subject-rights clause (users cannot find how to access their data)",
    },
    after: {
      ja: "本人は、当社に対し、個人情報の開示、訂正、追加、削除、利用停止または第三者提供の停止を請求することができます。請求は、第 ___ 条のお問い合わせ窓口までご連絡ください。",
      en: "The User may request disclosure, correction, addition, deletion, suspension of use, or suspension of third-party disclosure of their personal information. Contact the point in Section ___.",
    },
  },
  use_for: ["legal/contract"],
};
