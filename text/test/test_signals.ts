import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const idsFor = (source: string, genre = "business/report", adapter: LanguageAdapter = ja): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.map((finding) => finding.rule);

/** 密度を見る rule は短い文書を測らない。嵩を足すための本文。 */
const BULK = "本日の連絡です。今日も順調に進めます。明日も続けます。".repeat(20);
const BULK_EN = "We shipped the release and reported the numbers to the team. ".repeat(40);

describe("emoji-density", () => {
  it("invalid: 絵文字が並ぶ", () => {
    assert.ok(idsFor(`# 連絡\n\n${"🎉 進捗 🚀 順調 ✨ 期待 💪 頑張り 🔥 ".repeat(4)}${BULK}`).includes("emoji-density"));
  });

  it("valid: 絵文字が無ければ指摘しない", () => {
    assert.ok(!idsFor(`# 連絡\n\n${BULK}`).includes("emoji-density"));
  });

  it("英語でも同じ rule が動く", () => {
    assert.ok(idsFor(`# Report\n\n${"🎉 Great 🚀 progress ✨ today 💪 ".repeat(4)}${BULK_EN}`, "business/report", en).includes("emoji-density"));
  });

  it("短い文書は測らない。密度が暴れるため", () => {
    assert.ok(!idsFor("# 連絡\n\n🎉 進捗 🚀 順調 ✨ 期待。").includes("emoji-density"));
  });
});

describe("ngram-repetition", () => {
  it("invalid: 同じ言い回しが繰り返される", () => {
    const source = `# 見出し\n\n${"これは大事ではありません。あれも大事ではありません。".repeat(5)}${BULK}`;
    assert.ok(idsFor(source).includes("ngram-repetition"));
  });

  it("valid: 固有名詞の繰り返しは数えない", () => {
    // 実文書で測ったら、上位は「AGENTS.m」「シンギュラリティ」のような名前だった。
    const source = `# 見出し\n\n${"シンギュラリティソサエティが主催します。".repeat(8)}${BULK}`;
    const worst = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.find(
      (finding) => finding.rule === "ngram-repetition",
    );
    assert.ok(!String(worst?.values["word"] ?? "").includes("シンギュラリティ"));
  });

  it("文をまたいで数えない", () => {
    // 文の終わりと次の文の始まりが繋がると、名前が言い回しに見える。
    const source = `# 見出し\n\n${"です。シンギュラ。".repeat(8)}${BULK}`;
    const worst = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.find(
      (finding) => finding.rule === "ngram-repetition",
    );
    assert.ok(!String(worst?.values["word"] ?? "").includes("す。シンギュラ"));
  });
});

describe("undefined-acronym", () => {
  it("invalid: 説明のない略語が並ぶ", () => {
    assert.ok(idsFor(`# 連絡\n\nSRE と SLO と MTTR と RPO の方針を見直します。${BULK}`).includes("undefined-acronym"));
  });

  it("valid: 括弧で展開してあれば指摘しない", () => {
    const source = `# 連絡\n\nSRE（信頼性工学）と SLO（目標）と MTTR（復旧時間）と RPO（目標復旧点）を見直します。${BULK}`;
    assert.ok(!idsFor(source).includes("undefined-acronym"));
  });

  it("誰でも分かる略語は見ない", () => {
    assert.ok(!idsFor(`# 連絡\n\nURL と API と JSON と HTML と CSS を直します。${BULK}`).includes("undefined-acronym"));
  });
});

describe("concrete-evidence-density", () => {
  it("invalid: 数値もコードもリンクも無い節が並ぶ", () => {
    const sections = ["一", "二", "三", "四"].map((name) => `## ${name}\n\n抽象的な説明です。考えかたを述べます。理念を語ります。`).join("\n\n");
    assert.ok(idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });

  it("valid: 具体物があれば指摘しない", () => {
    const sections = ["一", "二", "三", "四"].map((name, index) => `## ${name}\n\n${String(index)} 件でした。実例を挙げます。数字で示します。`).join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });

  it("文の少ない節は測らない", () => {
    const sections = ["一", "二", "三", "四"].map((name) => `## ${name}\n\n一言だけ。`).join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });
});

describe("heading-echo の絞り込み", () => {
  const echoed = (source: string): boolean => idsFor(source, "blog/tech").includes("heading-echo");

  it("invalid: 見出しを繰り返して何も足さない", () => {
    assert.ok(echoed("## キャッシュの仕組み\n\nキャッシュの仕組みについて説明します。"));
  });

  it("valid: 見出しの語を含んでいても、中身を足していれば指摘しない", () => {
    // 実文書（英語 11 本）で測ったら、この条件なしでは 72.7% の文書が該当した。
    const source = "## ToolsAgent\n\nGraphAI provides ToolsAgent components that use LLMs to dynamically invoke agents from natural language input.";
    assert.ok(!idsFor(source, "blog/tech", en).includes("heading-echo"));
  });

  it("英語でも短い繰り返しは拾う", () => {
    assert.ok(idsFor("## Generating Output\n\nVarious outputs can be generated:", "blog/tech", en).includes("heading-echo"));
  });
});
