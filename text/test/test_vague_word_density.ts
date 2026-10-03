import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// あいまいな語の密度（vague-word-density）。例文はすべて自作。

const RULE = "vague-word-density";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const PLAIN_JA = "会議は毎週月曜の十時に始まり、議題は前の週の金曜までに共有します。";
const PLAIN_EN = "The meeting starts at ten every Monday, and the agenda goes out by the Friday before. ";

describe("vague-word-density: あいまいな語が文書の長さに対して多い所", () => {
  it("重なれば、見つけた語ごとに指す", () => {
    const source = `${PLAIN_JA.repeat(15)}障害は適宜報告し、必要に応じて連絡します。記録は適切に残し、なるべく早めにまとめます。\n`;
    const findings = findingsOf(source);
    assert.ok(findings.length >= 4, findings.join("\n"));
    assert.match(findings[0] ?? "", /^「適宜」など、あいまいな語が 1000 字あたり \d+ 個あります（2 個まで）$/u);
  });

  it("英語の文書は英語で言う", () => {
    const source = `${PLAIN_EN.repeat(13)}Report incidents as needed and notify the appropriate people in a timely manner. Keep adequate records where possible.\n`;
    const findings = findingsOf(source, en);
    assert.ok(findings.length >= 4, findings.join("\n"));
    assert.match(findings[0] ?? "", /^"[^"]+" and other vague words: \d+ per 1000 words \(limit 4\)$/u);
  });

  it("長い文書の中の一つ二つは普通の言い方として指さない", () => {
    assert.deepEqual(findingsOf(`${PLAIN_JA.repeat(30)}資料は適宜更新します。\n`), []);
    assert.deepEqual(findingsOf(`${PLAIN_EN.repeat(30)}We update the slides as needed.\n`, en), []);
  });

  it("あいまいな語が無ければ何も言わない", () => {
    assert.deepEqual(findingsOf(`${PLAIN_JA.repeat(10)}\n`), []);
  });
});
