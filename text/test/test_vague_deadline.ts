import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { vagueDeadlines } from "../packages/chaff/src/detectors/vague-deadline.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// vague-deadline: a contract's time limit left to the reader (速やかに, promptly) where the contract writes most of its
// limits as numbers. Self-written text.

const wordsIn = (adapter: LanguageAdapter, source: string, genre = "legal/contract"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "vague-deadline")
    .map((finding) => String(finding.values["word"]));

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const JA_LIMITS = ["第1条　乙は、毎月5日までに、前月の業務を甲に報告する。", "", "第2条　甲は、報告を受けた日から10日以内に、結果を乙に通知する。", ""];
const EN_LIMITS = [
  "1. The Supplier shall deliver each report by the fifth business day of the month.",
  "",
  "2. The Customer shall pay each invoice within thirty days of receiving it.",
  "",
];
const ja_ = (...lines: string[]): string => [...JA_LIMITS, ...lines, ""].join("\n");
const en_ = (...lines: string[]): string => [...EN_LIMITS, ...lines, ""].join("\n");

describe("vague-deadline", () => {
  it("reports a vague limit in a contract that writes its other limits as numbers", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　乙は、甲の求めを受けたときは、速やかに資料を提出する。")), ["速やかに"]);
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲は、前項の請求を受けたときは、遅滞なく修補する。")), ["遅滞なく"]);
    assert.deepEqual(wordsIn(en, en_("3. The Supplier shall notify the Customer promptly of any breach.")), ["promptly"]);
    assert.deepEqual(wordsIn(en, en_("3. The Customer shall return the equipment within a reasonable time.")), ["within a reasonable time"]);
  });

  it("does not report where the vague limits are not the minority: the drafter chose to write limits that way", () => {
    assert.deepEqual(wordsIn(ja, "第1条　乙は、甲の求めを受けたときは、速やかに資料を提出する。\n"), []);
    const half = ["1. The Supplier shall notify the Customer promptly.", "", "2. The Customer shall pay within thirty days.", ""].join("\n");
    assert.deepEqual(wordsIn(en, half), []);
  });

  it("does not report a sentence that also states a limit in numbers, nor a precise one", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　乙は、速やかに、遅くとも7日以内に資料を提出する。")), []);
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲は、直ちに本契約を解除することができる。")), []);
    assert.deepEqual(wordsIn(en, en_("3. The Supplier shall notify the Customer promptly, and in any case within five business days.")), []);
    assert.deepEqual(wordsIn(en, en_("3. Either party may terminate this Agreement immediately on notice.")), []);
  });

  it("does not run in a statute, where these words are terms of art, nor outside the legal genres", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　事業者は、速やかに届け出なければならない。"), "legal/statute"), []);
    assert.deepEqual(wordsIn(en, en_("3. The seller must deliver the goods promptly."), "business/report"), []);
  });
});

describe("vagueDeadlines", () => {
  const text = (value: string, start = 0) => ({ start, text: value });
  const LIMITS = [text("7日以内", 100), text("10日以内", 200), text("within 30 days", 300)];

  it("finds each vague word, ignoring case, the longest one where two overlap", () => {
    assert.deepEqual(
      vagueDeadlines(
        [text("Promptly, as soon as reasonably practicable.", 10), ...LIMITS],
        ["promptly", "as soon as practicable", "as soon as reasonably practicable"],
        ["日以内", " days"],
      ),
      [
        { offset: 10, word: "Promptly" },
        { offset: 20, word: "as soon as reasonably practicable" },
      ],
    );
    assert.deepEqual(vagueDeadlines([text("可及的速やかに"), ...LIMITS], ["速やかに", "可及的速やかに"], ["日以内"]), [{ offset: 0, word: "可及的速やかに" }]);
  });

  it("does not read an English word inside a longer one", () => {
    assert.deepEqual(vagueDeadlines([text("unpromptly done"), ...LIMITS], ["promptly"], ["日以内"]), []);
  });

  it("counts sentences: vague ones are reported only when fewer than the concrete ones", () => {
    assert.deepEqual(vagueDeadlines([text("速やかに"), text("7日以内", 10)], ["速やかに"], ["日以内"]), []);
    assert.deepEqual(vagueDeadlines([text("速やかに、速やかに"), text("7日以内", 10), text("8日以内", 20)], ["速やかに"], ["日以内"]), [
      { offset: 0, word: "速やかに" },
      { offset: 5, word: "速やかに" },
    ]);
  });

  it("leaves a sentence with a concrete limit, and says nothing for empty input", () => {
    assert.deepEqual(vagueDeadlines([text("速やかに、7日以内に"), ...LIMITS], ["速やかに"], ["日以内"]), []);
    assert.deepEqual(vagueDeadlines([], ["速やかに"], []), []);
    assert.deepEqual(vagueDeadlines([text("速やかに"), ...LIMITS], [], ["日以内"]), []);
    assert.deepEqual(vagueDeadlines([text("速やかに"), ...LIMITS], [""], [""]), []);
  });
});
