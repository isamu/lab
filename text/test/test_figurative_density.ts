import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 飾りのたとえが多い（figurative-density）。例文はすべて自作。

const RULE = "figurative-density";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

/** 密度を測る長さに届くまで、たとえを含まない文を重ねる。 */
const padded = (sentence: string, times: number, body: string): string => `${body}\n\n${Array.from({ length: times }, () => sentence).join(" ")}\n`;

const JA_FILLER = "この手順では、設定ファイルを開いて値を確かめ、保存してから再起動します。";
const EN_FILLER = "Open the settings file, check each value, save it, and restart the service.";

describe("figurative-density: 飾りのたとえが多い", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("たとえが重なった文書を言う", () => {
    const jaFindings = findingsOf(
      padded(JA_FILLER, 30, "まるで魔法のように設定が終わります。最初の一行は呪文のようなものなので、おまじないとして書いておきます。"),
      ja,
    );
    assert.equal(jaFindings.length, 4);
    assert.match(jaFindings[0] ?? "", /^「まるで」など、飾りのたとえが 1000 字あたり \d+ 個あります（2 個まで）$/u);
    const enFindings = findingsOf(padded(EN_FILLER, 20, "The installer works like magic. Our secret sauce is an incantation that magically fixes every path."));
    assert.equal(enFindings.length, 4);
  });

  it("たとえが一つの文書と、例を挙げる「のような」は言わない", () => {
    assert.deepEqual(findingsOf(padded(JA_FILLER, 30, "まるで魔法のように設定が終わります。"), ja), []);
    assert.deepEqual(findingsOf(padded(JA_FILLER, 30, "Excel や Numbers のような表計算ソフトで開けます。PDF のような形式も読めます。"), ja), []);
    assert.deepEqual(findingsOf(padded(EN_FILLER, 20, "Tools such as Excel and Numbers can open the file.")), []);
  });

  it("短い文書は測らない", () => {
    assert.deepEqual(findingsOf("まるで魔法のように終わります。呪文のようなコマンドです。\n", ja), []);
  });
});
