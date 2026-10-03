// @ts-check
// chaff-plugin-legal-contract: 日本の契約書（NDA / 業務委託 / 利用規約・プライバシーポリシー）向けの chaff プラグイン。
// chaff.yaml に plugins: [chaff-plugin-legal-contract] で読み込む。
// すべての id は "legal-contract/" で始まるので、他プラグインや chaff 本体のルールと衝突しない。

import { definePlugin } from "chaffjs/api";
import { PARTY_ALIAS_MIX, partyAliasMix } from "./rules/party-alias-mix.mjs";
import { REQUIRED_CLAUSES_NDA, requiredClausesNda } from "./rules/required-clauses-nda.mjs";
import { REQUIRED_CLAUSES_OUTSOURCING, requiredClausesOutsourcing } from "./rules/required-clauses-outsourcing.mjs";
import { REQUIRED_CLAUSES_TOS, requiredClausesTos } from "./rules/required-clauses-tos.mjs";
import { REQUIRED_CLAUSES_PRIVACY, requiredClausesPrivacy } from "./rules/required-clauses-privacy.mjs";
import { MONO_TO_SURU_FILLER, monoToSuruFiller } from "./rules/mono-to-suru-filler.mjs";

const SOURCE = {
  title: "chaff-plugin-legal-contract",
  url: "https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-legal-contract",
};

export default definePlugin({
  name: "legal-contract",
  rules: [
    { ...PARTY_ALIAS_MIX, detect: partyAliasMix },
    { ...REQUIRED_CLAUSES_NDA, detect: requiredClausesNda },
    { ...REQUIRED_CLAUSES_OUTSOURCING, detect: requiredClausesOutsourcing },
    { ...REQUIRED_CLAUSES_TOS, detect: requiredClausesTos },
    { ...REQUIRED_CLAUSES_PRIVACY, detect: requiredClausesPrivacy },
    { ...MONO_TO_SURU_FILLER, detect: monoToSuruFiller },
  ],
  styles: [
    {
      id: "nda",
      name: { ja: "NDA 向け（必須条項と呼び方統一を厳しく）", en: "NDA (strict on required clauses and party aliases)" },
      summary: {
        ja: "秘密保持契約で欠けやすい条項と、甲乙と役割名の混在を強く拾います",
        en: "Catches missing NDA clauses and mixed party aliases",
      },
      source: SOURCE,
      rules: {
        "legal-contract/party-alias-mix": "strict",
        "legal-contract/required-clauses-nda": "strict",
        "legal-contract/required-clauses-outsourcing": "off",
        "legal-contract/required-clauses-tos": "off",
        "legal-contract/required-clauses-privacy": "off",
        "legal-contract/mono-to-suru-filler": "normal",
      },
    },
    {
      id: "outsourcing",
      name: { ja: "業務委託契約書向け", en: "Outsourcing agreement" },
      summary: {
        ja: "業務委託契約書で欠けやすい条項と、甲乙と役割名の混在を強く拾います",
        en: "Catches missing outsourcing clauses and mixed party aliases",
      },
      source: SOURCE,
      rules: {
        "legal-contract/party-alias-mix": "strict",
        "legal-contract/required-clauses-outsourcing": "strict",
        "legal-contract/required-clauses-nda": "off",
        "legal-contract/required-clauses-tos": "off",
        "legal-contract/required-clauses-privacy": "off",
        "legal-contract/mono-to-suru-filler": "normal",
      },
    },
    {
      id: "tos",
      name: { ja: "利用規約向け", en: "Terms of service" },
      summary: {
        ja: "利用規約で欠けやすい条項を強く拾います",
        en: "Catches missing terms-of-service clauses",
      },
      source: SOURCE,
      rules: {
        "legal-contract/required-clauses-tos": "strict",
        "legal-contract/required-clauses-nda": "off",
        "legal-contract/required-clauses-outsourcing": "off",
        "legal-contract/required-clauses-privacy": "off",
        "legal-contract/party-alias-mix": "off",
        "legal-contract/mono-to-suru-filler": "normal",
      },
    },
    {
      id: "privacy",
      name: { ja: "プライバシーポリシー向け", en: "Privacy policy" },
      summary: {
        ja: "個人情報保護法が要求する記載事項の欠落を強く拾います",
        en: "Catches privacy-policy items required by Japan's APPI",
      },
      source: SOURCE,
      rules: {
        "legal-contract/required-clauses-privacy": "strict",
        "legal-contract/required-clauses-nda": "off",
        "legal-contract/required-clauses-outsourcing": "off",
        "legal-contract/required-clauses-tos": "off",
        "legal-contract/party-alias-mix": "off",
        "legal-contract/mono-to-suru-filler": "normal",
      },
    },
  ],
});
