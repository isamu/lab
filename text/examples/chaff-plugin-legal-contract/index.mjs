// @ts-check
// chaff-plugin-legal-contract: 日本の契約書（NDA / 業務委託 / 利用規約）向けの chaff プラグイン。
// chaff.yaml に plugins: [chaff-plugin-legal-contract] で読み込む。
// すべての id は "legal-contract/" で始まるので、他プラグインや chaff 本体のルールと衝突しない。

import { definePlugin } from "chaffjs/api";
import { PARTY_ALIAS_MIX, partyAliasMix } from "./rules/party-alias-mix.mjs";
import { REQUIRED_CLAUSES_NDA, requiredClausesNda } from "./rules/required-clauses-nda.mjs";
import { MONO_TO_SURU_FILLER, monoToSuruFiller } from "./rules/mono-to-suru-filler.mjs";

export default definePlugin({
  name: "legal-contract",
  rules: [
    { ...PARTY_ALIAS_MIX, detect: partyAliasMix },
    { ...REQUIRED_CLAUSES_NDA, detect: requiredClausesNda },
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
      source: {
        title: "chaff-plugin-legal-contract",
        url: "https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-legal-contract",
      },
      rules: {
        "legal-contract/party-alias-mix": "strict",
        "legal-contract/required-clauses-nda": "strict",
        "legal-contract/mono-to-suru-filler": "normal",
      },
    },
  ],
});
