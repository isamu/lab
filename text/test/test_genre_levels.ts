import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { resolve } from "../packages/chaff/src/levels.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";

const RULES = loadRules("ja");

const ruleFor = (id: string): RuleDefinition => {
  const found = RULES.find((rule) => rule.id === id);
  if (found === undefined) throw new Error(`no rule ${id}`);
  return found;
};

/** 76 文字。business/email（70）では長すぎ、blog/tech（100）では長くない。 */
const SENTENCE =
  "先週の会議で決まった方針について、関係する各部署の担当者にあらためて共有しておきたいのですが、来週の定例までに確認をお願いできますでしょうか。";

const idsFor = (genre: string): string[] => runRules(buildDocument("t.md", SENTENCE, ja), RULES, {}, false, genre).findings.map((finding) => finding.rule);

describe("ジャンル別の閾値", () => {
  it("同じ文が、ジャンルによって長すぎたり長くなかったりする", () => {
    assert.ok(idsFor("business/email").includes("max-sentence-length"));
    assert.ok(!idsFor("blog/tech").includes("max-sentence-length"));
    assert.ok(!idsFor("blog/essay").includes("max-sentence-length"));
  });

  it("細かいジャンルが粗いジャンルに勝つ", () => {
    const rule = ruleFor("max-sentence-length");
    assert.equal(resolve(rule, "normal", "business/email").limit, 70);
    assert.equal(resolve(rule, "normal", "business/report").limit, 100);
  });

  it("ジャンルを知らなければ既定の表を使う", () => {
    assert.equal(resolve(ruleFor("max-sentence-length"), "normal").limit, 100);
  });

  it("上書きの無いジャンルは既定の表に落ちる", () => {
    assert.equal(resolve(ruleFor("max-sentence-length"), "normal", "technical/spec").limit, 100);
  });

  it("上書きを持たない rule はジャンルを渡しても変わらない", () => {
    const bold = ruleFor("bold-density");
    assert.equal(resolve(bold, "normal", "business/email").limit, resolve(bold, "normal").limit);
  });

  it("上書きに無い段は、そのジャンルの normal に落ちる", () => {
    // levels の段が欠けている rule で「変えたつもりで変わっていない」を作らないため。
    const rule: RuleDefinition = { ...ruleFor("max-sentence-length"), levels: { normal: 100 }, by_genre: { "business/email": { normal: 70 } } };
    const got = resolve(rule, "strict", "business/email");
    assert.equal(got.limit, 70);
    assert.ok(got.fellBackToNormal);
  });
});
