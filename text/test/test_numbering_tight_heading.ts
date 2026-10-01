import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { dottedNumber } from "../packages/chaff/src/structure/universal.ts";
import { unlabeledHeading } from "../packages/chaff/src/heading-label.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { LanguageAdapter, StructurePatterns } from "../packages/chaff/src/plugin.ts";

// A heading whose title follows its number with no space (「## 7.委託」「## 第7条委託」) is still numbered. Every text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");
const ON_HEADING = { open: [], isHeading: true };
const IN_BODY = { open: [], isHeading: false };

const patternsOf = (adapter: LanguageAdapter): StructurePatterns => {
  if (adapter.structure === undefined) throw new Error(`lang-${adapter.id} has no structure`);
  return adapter.structure;
};

const gapsOf = (adapter: LanguageAdapter, source: string): (readonly [unknown, unknown])[] =>
  runRules(buildDocument("c.md", source, adapter), loadRules(adapter.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap" || finding.rule === "dangling-reference")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const threeSections = (second: string): string =>
  lines("# 規程", "", "## 6. 管理", "", "本文です。", "", `## ${second}`, "", "本文です。", "", "## 8. 提供", "", "本文です。");

const threeArticles = (second: string): string =>
  lines("# 規程", "", "## 第6条 管理", "", "本文です。", "", `## ${second}`, "", "本文です。", "", "## 第8条 提供", "", "本文です。");

describe("a dotted number with its title right after the dot, in a heading", () => {
  it("「7.委託」「7．委託」「4.2.委託」「2.Overview」 are numbered", () => {
    assert.deepEqual(
      ["7.委託", "7．委託", "7． 委託", "4.2.委託", "2.Overview", "7.「委託」"].map((heading) => dottedNumber(heading, ON_HEADING)?.number),
      ["7", "7", "7", "4.2", "2", "7"],
    );
    assert.equal(dottedNumber("7.委託", ON_HEADING)?.heading, "委託");
    assert.equal(dottedNumber("7．委託", ON_HEADING)?.closedByDot, true);
  });

  it("a decimal, a version, or the same text in the body is not a number", () => {
    const headings = ["1.5万人の利用者", "3.11を忘れない", "2.x 系の変更", "1.rc 版", "7..委託", "7."];
    assert.deepEqual(
      headings.map((heading) => dottedNumber(heading, ON_HEADING)),
      headings.map(() => undefined),
    );
    assert.equal(dottedNumber("7.委託", IN_BODY), undefined);
    assert.equal(dottedNumber("4.2.委託", IN_BODY), undefined);
  });

  it("日本語: 「## 7.委託」「## 7．委託」は 6 と 8 のあいだで、抜けは無い", () => {
    assert.deepEqual(gapsOf(ja, threeSections("7.委託")), []);
    assert.deepEqual(gapsOf(ja, threeSections("7．委託")), []);
  });

  it("日本語: 本当の抜けは詰めた形でも言う（6 の次が 8）", () => {
    const source = lines("# 規程", "", "## 6.管理", "", "本文です。", "", "## 8.提供", "", "本文です。");
    assert.deepEqual(gapsOf(ja, source), [["6", "8"]]);
  });

  it("English: 「## 7.Outsourcing」 is section 7", () => {
    const source = lines("# Policy", "", "## 6. Control", "", "Body text.", "", "## 7.Outsourcing", "", "Body text.", "", "## 8. Provision", "", "Body text.");
    assert.deepEqual(gapsOf(en, source), []);
  });
});

describe("日本語: 見出しの「第7条委託」「第2章概要」", () => {
  const numbered = (line: string, context = ON_HEADING): string | undefined => patternsOf(ja).numbered(line, context)?.label;

  it("題を詰めた条・章・節の見出しを読む", () => {
    assert.deepEqual(
      ["第7条委託", "第7条の2委託", "第2章概要", "第3節カタカナの題", "第七条「委託」"].map((line) => numbered(line)),
      ["第7条", "第7条の2", "第2章", "第3節", "第七条"],
    );
    assert.equal(patternsOf(ja).numbered("第7条委託", ON_HEADING)?.heading, "委託");
  });

  it("後ろが平仮名・次の番号・並べる語なら読まない。本文の行でも読まない", () => {
    assert.deepEqual(
      [
        "第3条に定める事項",
        "第2章では",
        "第2章第1節",
        "第7条2項",
        "第4条及び第5条の扱い",
        "第4条又は第5条",
        "第4条並びに第5条",
        "第2条若しくは第3条の場合",
        "第2条乃至第5条",
      ].map((line) => numbered(line)),
      [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined],
    );
    assert.equal(numbered("第7条委託", IN_BODY), undefined);
  });

  it("「## 第7条委託」は 6 と 8 のあいだで、自分を指す参照の抜けにもならない", () => {
    assert.deepEqual(gapsOf(ja, threeArticles("第7条委託")), []);
  });
});

describe("heading-echo reads the same label", () => {
  it("「7.委託」「第7条委託」 measure the title 「委託」", () => {
    const labelPattern = undefined;
    assert.equal(unlabeledHeading("7.委託", patternsOf(ja), labelPattern), "委託");
    assert.equal(unlabeledHeading("7．委託", patternsOf(ja), labelPattern), "委託");
    assert.equal(unlabeledHeading("第7条委託", patternsOf(ja), labelPattern), "委託");
    assert.equal(unlabeledHeading("2.Overview", patternsOf(en), labelPattern), "Overview");
    assert.equal(unlabeledHeading("2.x 系の変更", patternsOf(ja), labelPattern), "2.x 系の変更");
  });
});
