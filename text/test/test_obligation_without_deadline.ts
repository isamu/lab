import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { statesAmount, untimedDuties, type DutyWords } from "../packages/chaff/src/detectors/obligation-without-deadline.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// obligation-without-deadline: a duty to pay, deliver, return or notify with no time at all, in a contract that gives
// most of its other duties one. Self-written text.

const wordsIn = (adapter: LanguageAdapter, source: string, genre = "legal/contract"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "obligation-without-deadline")
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

describe("obligation-without-deadline", () => {
  it("reports a timed duty with no limit in a contract that gives its other duties one", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲は、本契約が解除されたときは、解除の日までの委託料を日割りで計算して支払う。")), ["支払"]);
    assert.deepEqual(wordsIn(ja, ja_("第3条　乙は、納入を受けたときは、検査を行い、その結果を甲に書面で通知するものとする。")), ["通知"]);
    assert.deepEqual(wordsIn(ja, ja_("第3条　当社は、本規約を変更するときは、ユーザーに通知します。")), ["通知"]);
    assert.deepEqual(wordsIn(en, en_("3. On a written request, each Party shall return or destroy the other Party's Confidential Information.")), ["return"]);
    assert.deepEqual(wordsIn(en, en_("3. The Company will notify you of any change to these Terms by email.")), ["notify"]);
  });

  it("does not report where the duties without a limit are not the minority", () => {
    assert.deepEqual(wordsIn(ja, "第1条　甲は、委託料を支払う。\n\n第2条　乙は、資料を提出する。\n"), []);
    const half = ["1. The Customer shall pay the fees.", "", "2. The Supplier shall deliver the goods within ten days.", ""].join("\n");
    assert.deepEqual(wordsIn(en, half), []);
  });

  it("does not report a duty whose sentence or line states a limit, a vague one, or terms elsewhere", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲は、解除の日から30日以内に、委託料を支払う。")), []);
    assert.deepEqual(wordsIn(ja, ja_("第3条　乙は、速やかに資料を提出する。")), []);
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲は、別途定める支払条件に従い、委託料を支払う。")), []);
    assert.deepEqual(
      wordsIn(en, en_("3. The Customer will pay the fees described in the Order. All amounts are due within 30 days after the invoice date.")),
      [],
    );
    assert.deepEqual(wordsIn(en, en_("3. The Supplier shall notify the Customer promptly of any breach.")), []);
    assert.deepEqual(wordsIn(en, en_("3. The Customer shall pay the Fees in accordance with the Order Form.")), []);
  });

  it("does not report a right, a duty not to act, an amount, or a duty that is not an act at a time", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　乙は、甲に対し、資料の返還を請求することができる。")), []);
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲は、乙に対し、月額150,000円を支払う。")), []);
    assert.deepEqual(wordsIn(ja, ja_("第3条　乙は、秘密情報を厳重に管理する。")), []);
    assert.deepEqual(wordsIn(ja, ja_("第3条　甲が資料を提出したときは、乙はこれを保管する。")), []);
    assert.deepEqual(wordsIn(en, en_("3. The Customer may return the goods.")), []);
    assert.deepEqual(wordsIn(en, en_("3. The Customer will not submit Sensitive Data to the Service.")), []);
    assert.deepEqual(wordsIn(en, en_("3. The Customer shall pay the Supplier a monthly fee of $9,000.")), []);
    assert.deepEqual(wordsIn(en, en_("3. Each party shall keep the other party's information confidential.")), []);
  });

  it("does not run in a statute nor outside the legal genres", () => {
    assert.deepEqual(wordsIn(ja, ja_("第3条　事業者は、手数料を国に支払う。"), "legal/statute"), []);
    assert.deepEqual(wordsIn(en, en_("3. The seller must deliver the goods."), "business/report"), []);
  });
});

describe("untimedDuties", () => {
  const text = (value: string, start = 0, sameLine = false) => ({ start, text: value, sameLine });
  const words = (overrides: Partial<DutyWords> = {}): DutyWords => ({
    acts: ["pay", "return"],
    markers: ["shall", "agrees to"],
    negations: ["not"],
    endings: [],
    limits: ["within … day", "by the"],
    notLimits: [],
    vague: ["promptly"],
    deferrals: ["in accordance with"],
    permissions: [{ pattern: "may" }],
    currencies: [{ pattern: "$", position: "before" }],
    ...overrides,
  });
  const LIMITS = [text("Pay within 3 days.", 100), text("Return by the 5th.", 200)];

  it("finds the act after a marker, within reach, ignoring case, and gives its offset", () => {
    assert.deepEqual(untimedDuties([text("The Customer SHALL, at its option, Pay the fees.", 10), ...LIMITS], words()), [{ offset: 45, act: "Pay" }]);
    assert.deepEqual(untimedDuties([text("The Customer agrees to pay the fees."), ...LIMITS], words()), [{ offset: 23, act: "pay" }]);
    assert.deepEqual(untimedDuties([text("The Customer shall use, keep, store and then pay it."), ...LIMITS], words()), []);
    assert.deepEqual(untimedDuties([text("The Customer shall repay the fees."), ...LIMITS], words()), []);
  });

  it("reads a Japanese act as the sentence's last predicate: a stem and an ending", () => {
    const japanese = words({ acts: ["支払", "通知"], endings: ["う", "する", "するものとする"], limits: ["日以内", "までに"], notLimits: ["までの"] });
    const LIMITS_JA = [text("7日以内に払う。", 100), text("5日までに出す。", 200)];
    assert.deepEqual(untimedDuties([text("甲は、委託料を支払う。"), ...LIMITS_JA], japanese), [{ offset: 7, act: "支払" }]);
    assert.deepEqual(untimedDuties([text("乙は、結果を通知するものとする。"), ...LIMITS_JA], japanese), [{ offset: 6, act: "通知" }]);
    assert.deepEqual(untimedDuties([text("甲は、通知したときは、これを保管する。"), ...LIMITS_JA], japanese), []);
    assert.deepEqual(untimedDuties([text("甲は、解除の日までの委託料を支払う。"), ...LIMITS_JA], japanese).length, 1);
    assert.deepEqual(untimedDuties([text("甲は、解除の日までに委託料を支払う。"), ...LIMITS_JA], japanese), []);
  });

  it("leaves a duty with a limit on the rest of its line, but not on the next line", () => {
    assert.deepEqual(untimedDuties([text("Customer shall pay."), text("It is due within 3 days.", 20, true), ...LIMITS], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), text("It is due within 3 days.", 20, false), ...LIMITS], words()).length, 1);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), text("Do so in accordance with Annex 1.", 20, true), ...LIMITS], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), text("Promptly.", 20, true), ...LIMITS], words()), []);
    const third = [text("Customer shall pay."), text("Then sign.", 20, true), text("Due within 3 days.", 30, true), ...LIMITS];
    assert.deepEqual(untimedDuties(third, words()), []);
  });

  it("reads a phrase limit as whole words only", () => {
    const byThe = [text("Return by the 5th.", 100), text("Return by the 6th.", 200)];
    assert.deepEqual(untimedDuties([text("Customer shall pay."), ...byThe], words()).length, 1);
    const byTheir = [text("Signed by their agents.", 100), text("Kept by thereby.", 200)];
    assert.deepEqual(untimedDuties([text("Customer shall pay."), ...byTheir], words()), []);
  });

  it("counts sentences: duties are reported only when fewer than the sentences with a limit", () => {
    assert.deepEqual(untimedDuties([text("Customer shall pay."), text("Pay within 3 days.", 20)], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), text("Supplier shall return it.", 20), ...LIMITS], words()), []);
    assert.deepEqual(
      untimedDuties([text("Customer shall pay."), text("Supplier shall return it.", 20), ...LIMITS, text("Within 2 days.", 300)], words()).length,
      2,
    );
  });

  it("leaves a right, a duty not to act, an amount and a vague limit", () => {
    assert.deepEqual(untimedDuties([text("Customer may, and shall, pay."), ...LIMITS], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall not pay it."), ...LIMITS], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay $ 9,000."), ...LIMITS], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall promptly pay."), ...LIMITS], words()), []);
  });

  it("says nothing for empty input or empty word lists", () => {
    assert.deepEqual(untimedDuties([], words()), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), ...LIMITS], words({ acts: [] })), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), ...LIMITS], words({ markers: [] })), []);
    assert.deepEqual(untimedDuties([text("Customer shall pay."), ...LIMITS], words({ limits: [] })), []);
    assert.deepEqual(untimedDuties([text("甲は支払う。"), ...LIMITS], words({ acts: [""], endings: [""] })), []);
  });
});

describe("statesAmount", () => {
  const currencies = [
    { pattern: "$", position: "before" as const },
    { pattern: "円", position: "after" as const },
    { pattern: "", position: "after" as const },
  ];

  it("reads a number right after a leading mark or right before a trailing one", () => {
    assert.equal(statesAmount("a fee of $9,000", currencies), true);
    assert.equal(statesAmount("a fee of $ 9,000", currencies), true);
    assert.equal(statesAmount("月額150,000円を", currencies), true);
    assert.equal(statesAmount("88万円を", currencies), true);
  });

  it("does not read a mark without a number beside it", () => {
    assert.equal(statesAmount("in US$ terms", currencies), false);
    assert.equal(statesAmount("円建てで", currencies), false);
    assert.equal(statesAmount("", currencies), false);
    assert.equal(statesAmount("$9,000", []), false);
  });
});
