import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { denialWords, unpromptedDenials } from "../packages/chaff/src/detectors/unprompted-denial.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// unprompted-denial: a sentence that ends by denying a premise nobody stated ("This isn't about tooling.",
// 「〜の話ではありません」). One or two move an argument along; a share of them is the habit. Self-written samples.

const RULE = "unprompted-denial";

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

/** The sentences the rule counts as denials in a text. */
const denials = (adapter: LanguageAdapter, text: string): string[] => {
  const doc = buildDocument("t.md", text, adapter);
  const contrast = { frames: doc.lexicons["contrast-frame"] ?? [], leads: doc.lexicons["contrast-lead"] ?? [], turns: doc.lexicons["contrast-turn"] ?? [] };
  return unpromptedDenials(doc.sentences, denialWords(doc.lexicons[RULE] ?? []), contrast).map((hit) => hit.sentence.text.trim());
};

const findings = (adapter: LanguageAdapter, source: string, genre = "blog/tech") =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === RULE);

describe("unpromptedDenials (ja)", () => {
  const counted = [
    "パラメータは、学習の設定の話ではありません。",
    "数字が大きいことは、賢さの保証になりません。",
    "大きくすれば消える差ではない。",
    "性能が同じだから並ぶのではありません。",
    "この基準には、好みが入る余地がありません。",
    "必ず勝てるわけではない。",
  ];
  counted.forEach((text) => {
    it(`counts 「${text}」`, () => assert.deepEqual(denials(ja, text), [text]));
  });

  const legitimate: ReadonlyArray<readonly [string, string]> = [
    ["a rule", "社員は、許可なく私物の端末を持ち込んではならない。"],
    ["a prohibition", "会議中に私語をするべきではありません。"],
    ["not only", "参加できるのは、社員だけではありません。"],
    ["an evaluation", "古い設定を移すのは簡単ではありません。"],
    ["a set phrase", "ただし、別に定めたときはこの限りではない。"],
    ["a fact with its reason", "この端末は貸出用のため、持ち帰りの対象ではありません。"],
    ["a fact with its reason (から)", "この端末は貸出用だから持ち帰りの対象ではありません。"],
    ["a contrast frame", "問題は道具ではなく、運用です。"],
  ];
  legitimate.forEach(([kind, text]) => {
    it(`does not count ${kind}: 「${text}」`, () => assert.deepEqual(denials(ja, text), []));
  });

  it("does not count a denial that answers the previous sentence's question or premise", () => {
    assert.deepEqual(denials(ja, "この表は毎月作り直すのでしょうか。毎月の作業ではありません。"), []);
    assert.deepEqual(denials(ja, "高い機材ほどよく写ると思うかもしれません。値段で決まる話ではありません。"), []);
  });

  it("counts the same denial when nothing before it said so", () => {
    assert.deepEqual(denials(ja, "表は四月に作りました。毎月の作業ではありません。"), ["毎月の作業ではありません。"]);
  });
});

describe("unpromptedDenials (en)", () => {
  const counted = ["This isn't about tooling.", "That's not the point.", "It's not a question of budget.", "The goal isn't speed."];
  // "The goal isn't speed." has no follow word: only a denial of what something is counts.
  it("counts a denial of what something is", () => assert.deepEqual(denials(en, counted.slice(0, 3).join(" ")), counted.slice(0, 3)));
  it("does not count a negated property", () => assert.deepEqual(denials(en, "The goal isn't speed. It is not ready yet."), []));

  it("does not count a denial with its reason, an answer to a question, or a contrast frame", () => {
    assert.deepEqual(denials(en, "This is not a remote position because the lab is on site."), []);
    assert.deepEqual(denials(en, "Is this a security fix? It's not a security fix."), []);
    assert.deepEqual(denials(en, "You might think the budget decides. It's not about budget."), []);
    assert.deepEqual(denials(en, "It's not a feature. It's a promise."), []);
  });

  it("counts the long forms of the question and the answer", () => {
    assert.deepEqual(denials(en, "The answer is not a new tool."), ["The answer is not a new tool."]);
  });

  it("does not count a denial followed by a second clause", () => {
    assert.deepEqual(denials(en, "This isn't about tooling, and the schedule is fixed."), []);
  });

  it("does not count a sentence that only contains the words later on", () => {
    assert.deepEqual(denials(en, "If that's not the case, ask the manager."), []);
  });
});

const fillerJa = "私たちの課では、毎週月曜の朝に短い打ち合わせを開いています。先週に終えた仕事と、今週に手を付ける仕事を、一人ずつ順に話します。";
const fillerEn = "Our team meets every Monday morning for fifteen minutes. Each person says what they finished last week and what they start this week. ";

describe("unprompted-denial (the rule)", () => {
  it("reports an AI-like paragraph that keeps denying premises nobody stated (ja)", () => {
    const text = [
      "パラメータは、学習の設定の話ではありません。数字が大きいことは、賢さの保証になりません。",
      "公開された試験が測るのは、あなたの仕事ではありません。大きくすれば消える差ではない。",
      "ここで言いたいのは、道具選びの話ではありません。",
      fillerJa.repeat(8),
    ].join("");
    const found = findings(ja, `${text}\n`);
    assert.equal(found.length, 5);
    assert.equal(found[0]?.values["count"], 5);
  });

  it("does not report a human-like paragraph whose negations are rules, reasons and answers (ja)", () => {
    const text = [
      "会議中に私語をするべきではありません。社員は、許可なく私物の端末を持ち込んではならない。",
      "この端末は貸出用のため、持ち帰りの対象ではありません。この表は毎月作り直すのでしょうか。毎月の作業ではありません。",
      "参加できるのは、社員だけではありません。",
      fillerJa.repeat(8),
    ].join("");
    assert.deepEqual(findings(ja, `${text}\n`), []);
  });

  it("reports an AI-like paragraph of denials (en)", () => {
    const text = `This isn't about tooling. That's not the point of the review. It's not a question of budget either. ${fillerEn.repeat(10)}`;
    assert.equal(findings(en, `${text}\n`).length, 3);
  });

  it("does not report a human-like paragraph of rules, reasons and answers (en)", () => {
    const text = [
      "Staff must not bring their own laptops into the lab.",
      "This is not a remote position because the lab is on site.",
      "Is this a security fix? It's not a security fix.",
      "It's not ready yet.",
      fillerEn.repeat(10),
    ].join(" ");
    assert.deepEqual(findings(en, `${text}\n`), []);
  });

  it("does not report two denials: one or two move an argument along", () => {
    const text = `パラメータは、学習の設定の話ではありません。数字が大きいことは、賢さの保証になりません。${fillerJa.repeat(8)}`;
    assert.deepEqual(findings(ja, `${text}\n`), []);
  });

  it("does not report three denials in a long document: the share stays under the limit", () => {
    const text = `パラメータは、学習の設定の話ではありません。数字が大きいことは、賢さの保証になりません。大きくすれば消える差ではない。${fillerJa.repeat(60)}`;
    assert.deepEqual(findings(ja, `${text}\n`), []);
  });

  it("does not run in legal documents", () => {
    const text = `パラメータは、学習の設定の話ではありません。数字が大きいことは、賢さの保証になりません。大きくすれば消える差ではない。${fillerJa.repeat(8)}`;
    assert.deepEqual(findings(ja, `${text}\n`, "legal/contract"), []);
  });
});
