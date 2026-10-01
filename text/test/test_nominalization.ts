import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { hiddenVerbs } from "../packages/chaff/src/detectors/nominalization.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// nominalization: a verb hidden in a noun (調査を実施した for 調査した; "make a decision" for "decide"), as a density.
// Sources: the やさしい日本語 guideline, the Federal Plain Language Guidelines, GOV.UK. Self-written text only.

const RULE = "nominalization";

/** "matched→preferred" for every hidden verb in the text, whatever the density. */
const hidden = (text: string, adapter: LanguageAdapter): string[] =>
  hiddenVerbs(buildDocument("t.md", `# T\n\n${text}\n`, adapter)).map((found) => `${found.matched}→${found.preferred}`);

/** The rule's findings on a document, at the given level. */
const reported = (text: string, adapter: LanguageAdapter, genre = "business/report"): number =>
  runRules(buildDocument("t.md", `# T\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, genre).findings.filter(
    (finding) => finding.rule === RULE,
  ).length;

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("nominalization (ja): a verbal noun carried by を行う / を実施する", () => {
  it("names the noun with the carrying verb in its dictionary form, and the verb to write", () => {
    assert.deepEqual(hidden("先月、満足度の調査を実施しました。結果の確認を行い、改善の検討を行います。", ja), [
      "調査を実施する→調査する",
      "確認を行う→確認する",
      "検討を行う→検討する",
    ]);
  });

  it("in the order they are written, whatever the carrying verb", () => {
    assert.deepEqual(hidden("調査を実施し、確認を行った。", ja), ["調査を実施する→調査する", "確認を行う→確認する"]);
  });

  it("a noun that does not take する is not a hidden verb (イベントを行う)", () => {
    assert.deepEqual(hidden("来月、イベントを行う。", ja), []);
  });

  it("an event noun, whose carrying verb means to hold it, is not a hidden verb (研修を実施する is not 研修する)", () => {
    assert.deepEqual(hidden("新人の研修を実施した。期末の試験を行う。来週、会議を行う。", ja), []);
  });

  it("〜をする is ordinary and not counted", () => {
    assert.deepEqual(hidden("毎日、勉強をする。", ja), []);
  });

  it("a symbol the dictionary files as a verbal noun is not one", () => {
    assert.deepEqual(hidden("仮想マシン(VM)を実行させる。", ja), []);
  });

  it("the verb itself, 調査する, is what the rule asks for", () => {
    assert.deepEqual(hidden("満足度を調査した。結果を確認する。", ja), []);
  });
});

describe("nominalization (en): a phrase hiding a verb", () => {
  it("matches the phrase in any form of its verb, and names the verb", () => {
    assert.deepEqual(hidden("We made a decision. They will conduct an analysis of the data.", en), ["made a decision→decide", "conduct an analysis→analyze"]);
  });

  it("the verb itself, and a phrase not on the list, are not counted", () => {
    assert.deepEqual(hidden("We decided. They analyzed the data and made a cake.", en), []);
  });
});

describe("nominalization — a density, so one or two are fine", () => {
  const filler = "この報告は、会議室の使い方を部署ごとにまとめたものである。各部の担当者が記録をつけ、月末に総務部が集めた。".repeat(12);

  it("reports when hidden verbs are dense for the document's length", () => {
    const dense = `${filler}調査を実施した。確認を行った。検討を行った。整理を行った。共有を行った。`;
    assert.ok(reported(dense, ja) > 0);
  });

  it("does not report one in an ordinary-length document", () => {
    assert.equal(reported(`${filler}調査を実施した。`, ja), 0);
  });

  it("does not measure a document too short to measure", () => {
    assert.equal(reported("調査を実施した。確認を行った。", ja), 0);
  });

  it("is off in legal documents and literature", () => {
    const dense = `${filler}調査を実施した。確認を行った。検討を行った。整理を行った。共有を行った。`;
    const fires = (genre: string): boolean =>
      runRules(buildDocument("t.md", `# T\n\n${dense}\n`, ja), loadRules("ja"), {}, true, genre).findings.some((finding) => finding.rule === RULE);
    assert.deepEqual(["legal/contract", "legal/statute", "literature/fiction"].filter(fires), []);
    assert.equal(fires("business/report"), true);
  });
});

describe("the Japanese adapter marks a verbal noun VerbForm=Vnoun", () => {
  const featuresOf = (text: string, surface: string): string | undefined =>
    ja
      .segment(text)
      .sentences.flatMap((sentence) => sentence.tokens ?? [])
      .find((token) => token.surface === surface)?.features?.["VerbForm"];

  it("調査 and 確認 are, イベント and a parenthesis are not", () => {
    assert.equal(featuresOf("調査を行う。", "調査"), "Vnoun");
    assert.equal(featuresOf("確認する。", "確認"), "Vnoun");
    assert.equal(featuresOf("イベントを行う。", "イベント"), undefined);
    assert.equal(featuresOf("仮想マシン(VM)を実行させる。", ")"), undefined);
  });
});
