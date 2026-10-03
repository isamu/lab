import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 翻訳調の密度（translationese-density）。例文はすべて自作。

/** 500 字の床を越えるための、翻訳調を含まない一文。 */
const PLAIN = "設定は管理画面から変えられます。変えた内容はすぐに反映され、ほかの利用者にも同じ画面が見えます。";

const translated = (body: string, plain = 12): readonly string[] =>
  namedRuleRun("translationese-density", `# 設定\n\n${body}\n\n${PLAIN.repeat(plain)}\n`, ja).findings;

describe("translationese-density: 翻訳調が多い", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("重なった翻訳調を、文ごとに一つずつ指す", () => {
    const found = translated(
      "この機能は、あなたが設定を共有することを可能にします。キャッシュは速度において重要な役割を果たします。あなたは設定画面から変えられます。",
    );
    assert.equal(found.length, 3);
    assert.match(found[0] ?? "", /^「を可能にする」など、翻訳調の言い回しが 1000 字あたり \d+ 個あります（1 個まで）$/u);
  });

  it("千字に一つなら、人の書いた記事と同じなので言わない", () => {
    assert.deepEqual(translated("この機能は、設定の共有を可能にします。", 24), []);
    assert.equal(translated("この機能は、設定の共有を可能にします。あなたの設定も共有できます。", 24).length, 2);
  });

  it("素直な言い方と、短い文書は数えない", () => {
    assert.deepEqual(translated("この機能を使うと、設定を共有できます。速度にはキャッシュが大きく効きます。"), []);
    assert.deepEqual(namedRuleRun("translationese-density", "あなたは共有することを可能にします。あなたの設定です。\n", ja).findings, []);
  });
});
