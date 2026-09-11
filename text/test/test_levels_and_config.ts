import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { definedLevels, resolve } from "../packages/chaff/src/levels.ts";
import { applyLevel } from "../packages/chaff/src/config/write.ts";
import { loadConfig } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";

const RULES = loadRules("ja");
const ruleOf = (id: string) => {
  const rule = RULES.find((entry) => entry.id === id);
  assert.ok(rule, `${id} がない`);
  return rule;
};
const tmpConfig = (body?: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "chaff-")), "chaff.yaml");
  if (body !== undefined) writeFileSync(path, body, "utf8");
  return path;
};

describe("4 語と数値の対応", () => {
  it("4 語がそれぞれの数値になる", () => {
    const bold = ruleOf("bold-density");
    assert.equal(resolve(bold, "strict").limit, 1);
    assert.equal(resolve(bold, "normal").limit, 2);
    assert.equal(resolve(bold, "relaxed").limit, 4);
    assert.equal(resolve(bold, "off").level, "off");
  });

  it("段が定義されていなければ normal に落ち、落ちたことを伝える", () => {
    // 意味のある段が 2 つしかない rule のため。spec §18.1。
    const partial = { ...ruleOf("bold-density"), levels: { normal: 2, relaxed: 4 } };
    const got = resolve(partial, "strict");
    assert.equal(got.level, "normal");
    assert.equal(got.limit, 2);
    assert.equal(got.fellBackToNormal, true);
  });

  it("実際に区別できる段だけを列挙する", () => {
    const partial = { ...ruleOf("bold-density"), levels: { normal: 2, relaxed: 4 } };
    assert.deepEqual(definedLevels(partial), ["normal", "relaxed", "off"]);
  });
});

describe("設定の書き戻し", () => {
  it("新しい rule を、説明と理由のコメントつきで足す", () => {
    const path = tmpConfig();
    const outcome = applyLevel(path, ruleOf("bold-density"), "relaxed", "図の説明で太字を多用するため", "ja", "isamu");
    assert.equal(outcome.ok, true);
    const written = readFileSync(path, "utf8");
    assert.match(written, /bold-density: relaxed/u);
    assert.match(written, /太字は読者の目を止める道具です/u); // why が入る
    assert.match(written, /図の説明で太字を多用するため \/ isamu/u); // 理由が残る
    assert.equal(loadConfig(path).rules["bold-density"], "relaxed");
  });

  it("既存のコメントを壊さない", () => {
    const path = tmpConfig(["# チームの文章規範。触るときは理由を書くこと。", "", "genre: blog/tech", "", "rules:", "  heading-echo: relaxed", ""].join("\n"));
    applyLevel(path, ruleOf("bold-density"), "strict", "きびしくする", "ja", "isamu");
    const written = readFileSync(path, "utf8");
    assert.match(written, /# チームの文章規範。触るときは理由を書くこと。/u);
    assert.match(written, /genre: blog\/tech/u);
    assert.match(written, /heading-echo: relaxed/u);
    assert.match(written, /bold-density: strict/u);
  });

  it("既に理由があるものを --why なしで変えようとしたら拒否する", () => {
    // 古い理由が新しい値に残ると、履歴が嘘になる。spec §19.4。
    const path = tmpConfig();
    applyLevel(path, ruleOf("bold-density"), "relaxed", "図が多いため", "ja", "isamu");
    const before = readFileSync(path, "utf8");
    const outcome = applyLevel(path, ruleOf("bold-density"), "strict", undefined, "ja", "isamu");
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /--why/u);
    assert.equal(readFileSync(path, "utf8"), before, "拒否したのにファイルが変わっている");
  });

  it("--why があれば理由ごと置き換える", () => {
    const path = tmpConfig();
    applyLevel(path, ruleOf("bold-density"), "relaxed", "図が多いため", "ja", "isamu");
    applyLevel(path, ruleOf("bold-density"), "strict", "方針を変えたため", "ja", "isamu");
    const written = readFileSync(path, "utf8");
    assert.match(written, /bold-density: strict/u);
    assert.match(written, /方針を変えたため/u);
    assert.doesNotMatch(written, /図が多いため/u, "古い理由が残っている");
  });

  it("段が定義されていない level を指定したら、書き換えずに告げる", () => {
    const path = tmpConfig();
    const partial = { ...ruleOf("bold-density"), levels: { normal: 2, relaxed: 4 } };
    const outcome = applyLevel(path, partial, "strict", "きびしく", "ja", "isamu");
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /normal と同じ/u);
  });
});

describe("設定の読み込み", () => {
  it("4 語以外の値は無視する", () => {
    const path = tmpConfig("rules:\n  bold-density: relaxed\n  heading-echo: とてもきびしく\n");
    const config = loadConfig(path);
    assert.equal(config.rules["bold-density"], "relaxed");
    assert.equal(config.rules["heading-echo"], undefined);
  });

  it("空のファイルでも落ちない", () => {
    assert.deepEqual(loadConfig(tmpConfig("")).rules, {});
  });
});
