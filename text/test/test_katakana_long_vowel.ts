import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, type TeamRules } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { neededBy, runRules, runRulesWith, type RunContext } from "../packages/chaff/src/run.ts";
import { evaluate } from "../packages/chaff/src/eval.ts";
import { longFormMorae, moraCount, oddLongVowels, type KanaWord } from "../packages/chaff/src/long-vowel.ts";
import type { OptionLayer } from "../packages/chaff/src/rule-options.ts";
import { katakanaLongVowel } from "../packages/chaff/src/detectors/long-vowel.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const RULE = "katakana-long-vowel";
const RULES_JA = loadRules("ja");
const NONE: TeamRules = { jargon: [], requiredSections: [] };

const AT_NORMAL: RunContext = { settings: { [RULE]: "normal" }, experimental: false, genre: "business/report" };

const settingsLayer = (values: Record<string, unknown>): OptionLayer[] => [{ from: "chaff.yaml", values: { [RULE]: values } }];

/** The rule's findings as "matched→preferred:variant", with the rule at normal and the given options. */
const found = (source: string, options: Record<string, unknown> = {}, team: TeamRules = NONE): string[] =>
  runRulesWith(buildDocument("t.md", source, ja, team), RULES_JA, { ...AT_NORMAL, optionLayers: settingsLayer(options) })
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["matched"])}→${String(finding.values["preferred"])}:${finding.variant ?? ""}`);

const isDropped = (token: Token): boolean => token.features?.["LongVowelEnding"] === "Dropped";

const word = (surface: string, offset: number, dropped = false): KanaWord => ({ surface, offset, long: surface.endsWith("ー"), dropped });

describe("katakana-long-vowel", () => {
  before(async () => {
    await ja.prepare?.({ pos: true, features: ["LongVowelEnding"] });
    await en.prepare?.({ pos: true });
  });

  describe("moraCount: small kana join the one before, ッ ン ー count", () => {
    const cases: readonly (readonly [string, number])[] = [
      ["コンピューター", 6],
      ["コンピュータ", 5],
      ["カー", 2],
      ["キャ", 1],
      ["ウィンドウ", 4],
      ["カッター", 4],
      ["ファイル", 3],
      ["ヴァ", 1],
      ["ヶ", 1],
      ["", 0],
      ["きゃっと", 3],
    ];
    cases.forEach(([text, morae]) => {
      it(`${text || "(empty)"} is ${String(morae)}`, () => {
        assert.equal(moraCount(text), morae);
      });
    });

    it("counts the word with its final ー: カ and カー are both two", () => {
      assert.equal(longFormMorae("カー"), 2);
      assert.equal(longFormMorae("カ"), 2);
      assert.equal(longFormMorae("コンピュータ"), 6);
      assert.equal(longFormMorae("コンピューターー"), 6);
    });
  });

  describe("oddLongVowels (pure)", () => {
    it("drop: every word of min_morae or more written with a final ー", () => {
      const odd = oddLongVowels([word("コンピューター", 0), word("カー", 10), word("レーザ", 20)], "drop", 3);
      assert.deepEqual(
        odd.map((entry) => `${entry.word.surface}→${entry.preferred}`),
        ["コンピューター→コンピュータ"],
      );
    });

    it("drop with min_morae 2 reaches カー; with 7 reaches nothing", () => {
      assert.equal(oddLongVowels([word("カー", 0)], "drop", 2).length, 1);
      assert.equal(oddLongVowels([word("コンピューター", 0)], "drop", 7).length, 0);
    });

    it("keep: a short word the dictionary knows long, or the document writes long elsewhere", () => {
      const odd = oddLongVowels([word("メモリ", 0, true), word("データ", 5), word("サーバー", 10), word("サーバ", 20)], "keep", 3);
      assert.deepEqual(
        odd.map((entry) => `${entry.word.surface}→${entry.preferred}`),
        ["メモリ→メモリー", "サーバ→サーバー"],
      );
    });

    it("consistent: the fewer form of one word; on a tie the form used second", () => {
      const fewer = oddLongVowels([word("サーバー", 0), word("サーバー", 5), word("サーバ", 9)], "consistent", 3);
      assert.deepEqual(
        fewer.map((entry) => `${entry.word.surface}:${entry.variant}:${String(entry.count)}/${String(entry.of)}`),
        ["サーバ:same-word:1/3"],
      );
      const tie = oddLongVowels([word("サーバ", 0), word("サーバー", 5)], "consistent", 3);
      assert.deepEqual(
        tie.map((entry) => entry.word.surface),
        ["サーバー"],
      );
    });

    it("consistent: different words are not compared, even one the dictionary knows long", () => {
      const words = [word("ユーザー", 0), word("コンピューター", 5), word("メモリ", 12, true), word("データ", 20)];
      assert.deepEqual(oddLongVowels(words, "consistent", 3), []);
    });

    it("consistent: a word shorter than min_morae written both ways is left alone", () => {
      assert.deepEqual(oddLongVowels([word("カー", 0), word("カ", 5)], "consistent", 3), []);
      assert.equal(oddLongVowels([word("カー", 0), word("カ", 5)], "consistent", 2).length, 1);
    });

    it("consistent: nothing when every word is one way", () => {
      assert.deepEqual(oddLongVowels([word("サーバー", 0), word("ユーザー", 5)], "consistent", 3), []);
      assert.deepEqual(oddLongVowels([], "consistent", 3), []);
    });
  });

  describe("through the rule", () => {
    it("invalid: one word written both ways, with no setting", () => {
      assert.deepEqual(found("# 報告\n\nコンピューターを買いました。新しいコンピューターは速いです。古いコンピュータは捨てます。\n"), [
        "コンピュータ→コンピューター:same-word",
      ]);
    });

    it("valid: one way throughout says nothing, with no setting", () => {
      assert.deepEqual(found("# 報告\n\nコンピューターとプリンターを買いました。ユーザーが使います。\n"), []);
      assert.deepEqual(found("# 報告\n\nコンピュータとプリンタを買いました。ユーザが使います。\n"), []);
    });

    it("valid: different words written different ways, with no setting", () => {
      assert.deepEqual(found("# 報告\n\nユーザーがコンピューターとプリンターでメモリとブラウザを使います。\n"), []);
    });

    it("drop: every long word of three morae or more, the compound's parts one by one", () => {
      assert.deepEqual(found("# 報告\n\nユーザーインターフェースとレーザープリンターとカーを見ます。\n", { ending: "drop", min_morae: 3 }), [
        "ユーザー→ユーザ:drop",
        "レーザー→レーザ:drop",
        "プリンター→プリンタ:drop",
      ]);
    });

    it("drop: a proper noun, a listed name and an excepted word stay", () => {
      const team: TeamRules = { ...NONE, names: ["ブラウザー社"] };
      assert.deepEqual(found("# 報告\n\nディズニーとブラウザー社のサーバーとコンピューターを見ます。\n", { ending: "drop", except: ["コンピュータ"] }, team), [
        "サーバー→サーバ:drop",
      ]);
    });

    it("keep: a short word the dictionary knows long", () => {
      assert.deepEqual(found("# 報告\n\nメモリとデータとサーバを見ます。\n", { ending: "keep" }), ["メモリ→メモリー:keep", "サーバ→サーバー:keep"]);
    });

    it("drop: an excepted word listed in its long form exempts it too", () => {
      assert.deepEqual(found("# 報告\n\nサーバーとプリンターを見ます。\n", { ending: "drop", except: ["サーバー"] }), ["プリンター→プリンタ:drop"]);
    });

    it("keep: a short word whose long form the dictionary knows only as a name (ディズニー) is not a dropped ー", () => {
      assert.deepEqual(found("# 報告\n\nディズニとハードウェアとデータを見ます。\n", { ending: "keep" }), []);
    });

    it("the detector alone, with no settings, takes no side", () => {
      const doc = buildDocument("t.md", "# 報告\n\nサーバーとサーバーとプリンターを見ます。サーバも。\n", ja);
      assert.deepEqual(
        katakanaLongVowel(doc, { limit: 1 }).map((finding) => `${String(finding.values["matched"])}:${finding.variant ?? ""}`),
        ["サーバ:same-word"],
      );
    });

    it("an option that does not fit falls back to the default: consistent", () => {
      assert.deepEqual(found("# 報告\n\nコンピューターとプリンターを見ます。\n", { ending: "sometimes" }), []);
    });

    it("relaxed needs three odd words", () => {
      const source = "# 報告\n\nユーザーとサーバーを見ます。\n";
      const at = (level: "normal" | "relaxed"): number =>
        runRulesWith(buildDocument("t.md", source, ja), RULES_JA, {
          ...AT_NORMAL,
          settings: { [RULE]: level },
          optionLayers: settingsLayer({ ending: "drop" }),
        }).findings.filter((finding) => finding.rule === RULE).length;
      assert.equal(at("normal"), 2);
      assert.equal(at("relaxed"), 0);
    });

    it("chaff eval measures with the options chaff.yaml sets", () => {
      const doc = buildDocument("t.md", "# 報告\n\nサーバーを使います。\n", ja);
      const rule = RULES_JA.filter((entry) => entry.id === RULE);
      const at = (layers: OptionLayer[]): number => evaluate([doc], rule, "business/report", "ja", {}, layers)[0]?.sweep[0]?.findings ?? -1;
      assert.equal(at([]), 0);
      assert.equal(at(settingsLayer({ ending: "drop" })), 1);
    });

    it("asks the adapter for the dictionary's long forms only while the rule runs", () => {
      assert.deepEqual(neededBy(RULES_JA, {}, false, "business/report", "ja").features, []);
      assert.deepEqual(neededBy(RULES_JA, { [RULE]: "normal" }, false, "business/report", "ja").features, ["LongVowelEnding"]);
      assert.deepEqual(neededBy(RULES_JA, { [RULE]: "off" }, true, "business/report", "ja").features, []);
    });

    it("the adapter marks no dropped ー when no rule asked for it", async () => {
      const marked = (): boolean =>
        buildDocument("t.md", "# 報告\n\nメモリを使います。\n", ja)
          .sentences.flatMap((sentence) => sentence.tokens ?? [])
          .some(isDropped);
      await ja.prepare?.({ pos: true });
      const without = marked();
      await ja.prepare?.({ pos: true, features: ["LongVowelEnding"] });
      assert.equal(without, false);
      assert.equal(marked(), true);
    });

    it("is off by default (experimental) and does not run on English", () => {
      const source = "# 報告\n\nコンピューターとコンピュータ。\n";
      assert.ok(!runRules(buildDocument("t.md", source, ja), RULES_JA, {}, false, "business/report").findings.some((finding) => finding.rule === RULE));
      const english = runRules(buildDocument("t.md", "# Report\n\nThe computer works.\n", en), loadRules("en"), { [RULE]: "normal" }, false, "business/report");
      assert.ok(english.skipped.some((skip) => skip.rule === RULE));
    });
  });
});
