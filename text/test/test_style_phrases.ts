import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// Lexicon rules on the phrase detectors: wordy-phrase, weasel-word, homophone-slip, sentence-initial-so, doubled-nado.
// Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, adapter: LanguageAdapter = en, level: "strict" | "normal" = "normal"): readonly string[] =>
  namedRuleRun(rule, source, adapter, "a.md", "business/report", level).findings;

describe("wordy-phrase", () => {
  const RULE = "wordy-phrase";

  it("two sentences with a wordy phrase are reported at normal, one is not", () => {
    const two = "In order to save time, we met online. Due to the fact that the room was booked, we stayed home.\n";
    assert.deepEqual(findingsOf(RULE, two), ['"in order to" can be said in fewer words', '"due to the fact that" can be said in fewer words']);
    assert.deepEqual(findingsOf(RULE, "In order to save time, we met online.\n"), []);
    assert.deepEqual(findingsOf(RULE, "In order to save time, we met online.\n", en, "strict"), ['"in order to" can be said in fewer words']);
  });

  it("matches whole words only, and the short form is not reported", () => {
    assert.deepEqual(findingsOf(RULE, "The border order told us to wait. To save time, we met online.\n", en, "strict"), []);
    assert.deepEqual(findingsOf(RULE, "If the server fails, the job retries. Because it was late, we left.\n", en, "strict"), []);
  });
});

describe("weasel-word", () => {
  const RULE = "weasel-word";

  it("a claim credited to no one is reported from the first", () => {
    assert.deepEqual(findingsOf(RULE, "Many experts say remote work raises output.\n"), ['"many experts say" does not say who']);
    assert.deepEqual(findingsOf(RULE, "It is widely believed that the old API is slower.\n"), ['"it is widely believed" does not say who']);
  });

  it("a named source is not", () => {
    assert.deepEqual(findingsOf(RULE, "Smith (2021) found that short meetings save time.\n"), []);
  });
});

describe("homophone-slip", () => {
  const RULE = "homophone-slip";

  it("a pair the next word settles is reported", () => {
    assert.deepEqual(findingsOf(RULE, "The service restarts on it's own.\n"), ['"it\'s own" has one homophone typed for another']);
    assert.deepEqual(findingsOf(RULE, "Their are three open tickets.\n"), ['"their are" has one homophone typed for another']);
    assert.deepEqual(findingsOf(RULE, "We could of shipped sooner.\n"), ['"could of" has one homophone typed for another']);
  });

  it("the right forms, and pairs the next word does not settle, are not", () => {
    const right = "The service restarts on its own. There are three open tickets. It's time to ship. They're people we trust.\n";
    assert.deepEqual(findingsOf(RULE, right), []);
    assert.deepEqual(findingsOf(RULE, "Its antenna is bent. Their arena is full.\n"), []);
  });
});

describe("sentence-initial-so", () => {
  const RULE = "sentence-initial-so";

  it('"So," opening a sentence is reported', () => {
    assert.deepEqual(findingsOf(RULE, "The vendor was late. So, the launch slipped.\n"), ['1 sentence opens with "So," (1 needed)']);
  });

  it('"So far", "So that" and "so," inside a sentence are not', () => {
    assert.deepEqual(findingsOf(RULE, "So far the plan holds. So that it holds, we test it. We said so, twice.\n"), []);
  });
});

describe("doubled-nado", () => {
  const RULE = "doubled-nado";

  it("「など」と「等」を重ねた所を言う", () => {
    assert.deepEqual(findingsOf(RULE, "申請書等などを提出してください。\n", ja), ["「等など」は、「など」と「等」を重ねています"]);
    assert.deepEqual(findingsOf(RULE, "交通費、宿泊費など等は会社が負担します。\n", ja), ["「など等」は、「など」と「等」を重ねています"]);
  });

  it("片方だけ、「などなど」、語の一部の「等」は言わない", () => {
    assert.deepEqual(findingsOf(RULE, "申請書などを提出してください。書類等は返却しません。お菓子などなど。平等などの理念。\n", ja), []);
  });
});
