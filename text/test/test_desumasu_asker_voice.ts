import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isAskerSection } from "../packages/chaff/src/detectors/asker-voice.ts";
import type { Section } from "../packages/chaff/src/plugin.ts";

// 読み手の相談や質問を載せる節（【相談事例等】）の文は尋ねた人の言葉のままなので、文末の調子を本文と比べない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", "docs/faq").findings;

const advice = [
  "### 【アドバイス等】",
  "",
  "- 窓口では、契約の内容を一緒に確かめます。",
  "- 書面が手元にあれば、相談の際にお持ちください。",
  "- 解約の期限は契約書に書いてあります。",
  "- 期限を過ぎていても、まずはご相談ください。",
  "",
].join("\n");

const caseUnder = (heading: string): string => [`### ${heading}`, "", "○　解約の書面が届かなくなった。どうすればよいですか。", ""].join("\n");

const section = (heading: string): Section => ({ depth: 3, heading, span: { start: 0, end: 0 }, sentences: [], strongCount: 0, firstSentence: undefined });

const HEADINGS = [{ pattern: "相談事例等" }, { pattern: "ご質問" }];

describe("no-mixed-desumasu: 相談や質問を載せる節は尋ねた人の言葉", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("相談事例の節の、である調の文を指さない", () => {
    assert.deepEqual(findingsOf(`${caseUnder("【相談事例等】")}\n${advice}`), []);
    assert.deepEqual(findingsOf(`${caseUnder("ご質問内容")}\n${advice}`), []);
  });

  it("相談事例でない節の同じ文は、これまでどおり指す", () => {
    assert.equal(findingsOf(`${caseUnder("【経緯】")}\n${advice}`).length, 1);
    assert.equal(findingsOf(`${caseUnder("よくある質問")}\n${advice}`).length, 1);
    assert.equal(findingsOf(`${caseUnder("ご質問")}\n${advice}`).length, 1);
  });

  it("答えの節の中の調子の混ざりは、これまでどおり指す", () => {
    const slip = advice.replace("- 解約の期限は契約書に書いてあります。", "- 解約の期限は契約書に書いてある。");
    assert.equal(findingsOf(`${caseUnder("【相談事例等】")}\n${slip}`).length, 1);
  });

  it("isAskerSection: 番号と括弧を外した見出し全体で比べる", () => {
    assert.equal(isAskerSection(section("【相談事例等】"), HEADINGS), true);
    assert.equal(isAskerSection(section("［ご質問］"), HEADINGS), true);
    assert.equal(isAskerSection(section("相談事例等の一覧"), HEADINGS), false);
    assert.equal(isAskerSection(section(""), HEADINGS), false);
    assert.equal(isAskerSection(section("【】"), HEADINGS), false);
    assert.equal(isAskerSection(section("【相談事例等】"), []), false);
  });
});
