import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { oddRelatives, type RelativeUse } from "../packages/chaff/src/detectors/relative-pronoun-mix.ts";

// 限定の関係節の which と that（which-that-consistency）。例文はすべて自作。

const RULE = "which-that-consistency";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

const THAT_THREE = "The job that builds the site runs nightly. The script that checks links runs hourly. The task that sends mail runs daily.";

const use = (kind: string, at: number): RelativeUse => ({ word: { span: { start: at, end: at + kind.length }, surface: kind, pos: "DET" }, kind });

describe("which-that-consistency: 限定の関係節の which と that", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("多いほうと違う書き方を言う", () => {
    assert.deepEqual(findingsOf(`${THAT_THREE} The file which stores the keys is encrypted.`), [
      'This restrictive clause opens with "which"; the document mostly uses "that"',
    ]);
    assert.deepEqual(
      findingsOf("The file which stores keys is old. The job which builds it is new. The task which sends mail is slow. The step that signs it is fast."),
      ['This restrictive clause opens with "that"; the document mostly uses "which"'],
    );
  });

  it("一通りの文書、多いほうが少ない文書、使い分けている文書は言わない", () => {
    assert.deepEqual(findingsOf(THAT_THREE), []);
    assert.deepEqual(findingsOf("The job that builds the site runs nightly. The file which stores the keys is encrypted."), []);
    assert.deepEqual(oddRelatives([use("that", 0), use("that", 10), use("that", 20), use("which", 30), use("which", 40), use("which", 50)], 2).odd, []);
    assert.deepEqual(oddRelatives([], 2).odd, []);
  });

  it("非限定の節、前置詞の後ろの which、主語が続く that は数えない", () => {
    assert.deepEqual(findingsOf(`${THAT_THREE} The rule, which we added, works. The way in which it runs is odd. The report that we wrote is long.`), []);
  });

  it("単数の名詞の後ろの原形の動詞は、「どの」の which", () => {
    assert.deepEqual(findingsOf(`${THAT_THREE} The flag tells the import command which file in the folder to use.`), []);
    assert.deepEqual(findingsOf(`${THAT_THREE} Resources which set cookies load last.`), [
      'This restrictive clause opens with "which"; the document mostly uses "that"',
    ]);
  });

  it("引用、主語が続く that、疑問の which は数えず、副詞を挟んだ節は数える", () => {
    assert.deepEqual(findingsOf(`${THAT_THREE} The spec says "the file which stores the keys" in the old section.`), []);
    assert.deepEqual(findingsOf(`${THAT_THREE} Tell users which files contain secrets.`), []);
    assert.deepEqual(
      findingsOf(
        "The file which stores keys is old. The job which builds it is new. The task which sends mail is slow. The idea that results matter changed the plan.",
      ),
      [],
    );
    assert.deepEqual(findingsOf(`${THAT_THREE} The file which usually stores the keys is encrypted.`), [
      'This restrictive clause opens with "which"; the document mostly uses "that"',
    ]);
  });

  it("日本語の文書は読まない", () => {
    assert.deepEqual(findingsOf("この文書は日本語です。", ja), []);
  });
});
