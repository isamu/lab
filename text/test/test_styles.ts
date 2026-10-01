import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseStyle } from "../packages/chaff/src/style-parse.ts";
import { loadStyles } from "../packages/chaff/src/style-load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { optionProblems, settleOptions } from "../packages/chaff/src/rule-options.ts";
import { EMPTY, type Config } from "../packages/chaff/src/config/load.ts";
import { withStyle } from "../packages/chaff/src/config/style.ts";
import { optionLayersOf } from "../packages/chaff/src/config/option-problems.ts";
import { settingsOf } from "../packages/chaff/src/commands/feedback.ts";
import { runCli } from "./cli-run.ts";

const RULE = "katakana-long-vowel";
const TEXT = { ja: "説明", en: "text" };
const VALID = {
  id: "house",
  name: TEXT,
  summary: TEXT,
  source: { title: TEXT, url: "https://example.org/guide" },
  rules: { [RULE]: "normal" },
  options: { [RULE]: { ending: "drop" } },
};

const config = (overrides: Partial<Config>): Config => ({ ...EMPTY, path: "/x/chaff.yaml", ...overrides });

describe("house styles", () => {
  describe("the bundled styles", () => {
    const styles = loadStyles();
    const rules = loadRules("ja");
    const optionsByRule = Object.fromEntries(rules.map((rule) => [rule.id, rule.options ?? {}]));

    it("are ieice, jis-z8301-2011 and bunkacho", () => {
      assert.deepEqual(
        styles.map((style) => style.id),
        ["bunkacho", "ieice", "jis-z8301-2011"],
      );
    });

    const known = new Set(rules.map((rule) => rule.id));
    const unknownRules = (ids: readonly string[]): string[] => ids.filter((id) => !known.has(id));
    styles.forEach((style) => {
      it(`${style.id} names only rules chaff has, with options that fit`, () => {
        assert.deepEqual(unknownRules(Object.keys(style.rules)), []);
        assert.deepEqual(optionProblems({ from: style.id, values: style.options }, optionsByRule), []);
      });
    });

    it("ieice and jis-z8301-2011 drop the final ー from three morae; bunkacho keeps it", () => {
      const ending = (id: string): unknown => {
        const style = styles.find((entry) => entry.id === id);
        const rule = rules.find((entry) => entry.id === RULE);
        assert.ok(style !== undefined && rule?.options !== undefined);
        const settled = settleOptions(RULE, rule.options, [{ from: id, values: style.options }]);
        return `${String(settled["ending"]?.value)}/${String(settled["min_morae"]?.value)}`;
      };
      assert.equal(ending("ieice"), "drop/3");
      assert.equal(ending("jis-z8301-2011"), "drop/3");
      assert.equal(ending("bunkacho"), "keep/3");
    });
  });

  describe("parseStyle refuses a style it cannot read, naming the file", () => {
    const bad: readonly (readonly [string, Record<string, unknown>, RegExp])[] = [
      ["an id that is not the file's name", { ...VALID, id: "other" }, /id must be the file's name/u],
      ["a name in one language", { ...VALID, name: { ja: "説明" } }, /name needs a ja and an en/u],
      ["no source", { ...VALID, source: undefined }, /source needs a title and a url/u],
      ["an http source", { ...VALID, source: { title: TEXT, url: "http://example.org" } }, /https/u],
      ["a level that is not one of the four", { ...VALID, rules: { [RULE]: "loud" } }, /use strict, normal, relaxed or off/u],
      ["options that are not a map", { ...VALID, options: { [RULE]: "drop" } }, /options\.katakana-long-vowel must be a map/u],
      ["nothing set", { ...VALID, rules: {}, options: {} }, /must set rules or options/u],
    ];
    const reading = (raw: Record<string, unknown>) => (): unknown => parseStyle(raw, "house.yaml");
    const namesTheFile =
      (message: RegExp) =>
      (error: unknown): boolean =>
        error instanceof Error && error.message.startsWith("house.yaml") && message.test(error.message);
    bad.forEach(([what, raw, message]) => {
      it(`throws on ${what}`, () => {
        assert.throws(reading(raw), namesTheFile(message));
      });
    });

    it("reads a valid style", () => {
      assert.equal(parseStyle(VALID, "house.yaml").source.url, "https://example.org/guide");
    });
  });

  describe("withStyle: chaff.yaml, then the style, then the genre", () => {
    const styles = [parseStyle(VALID, "house.yaml")];

    it("adds the style's levels under chaff.yaml's own", () => {
      const applied = withStyle(config({ style: "house", rules: { "bold-density": "relaxed" } }), styles);
      assert.deepEqual(applied.rules, { [RULE]: "normal", "bold-density": "relaxed" });
      assert.deepEqual(applied.applied?.levelsFrom, [RULE]);
    });

    it("chaff.yaml's level wins over the style's, and is not credited to the style", () => {
      const applied = withStyle(config({ style: "house", rules: { [RULE]: "off" } }), styles);
      assert.equal(applied.rules[RULE], "off");
      assert.deepEqual(applied.applied?.levelsFrom, []);
    });

    it("chaff.yaml's options win over the style's; the style's fill the rest", () => {
      const rule = loadRules("ja").find((entry) => entry.id === RULE);
      assert.ok(rule?.options !== undefined);
      const applied = withStyle(config({ style: "house", options: { [RULE]: { min_morae: 4 } } }), styles);
      const settled = settleOptions(RULE, rule.options, optionLayersOf(applied));
      assert.deepEqual(settled["ending"], { value: "drop", from: "style: house" });
      assert.deepEqual(settled["min_morae"], { value: 4, from: "chaff.yaml" });
    });

    it("feedback reports the style, not the levels it decided, and still chaff.yaml's own", () => {
      const applied = withStyle(config({ style: "house", rules: { "bold-density": "off" } }), styles);
      assert.equal(settingsOf(applied, [RULE, "bold-density"]), "style: house\nrules:\n  bold-density: off");
      assert.equal(settingsOf(applied, [RULE]), "style: house");
    });

    it("no style, or one chaff does not have, changes nothing", () => {
      const plain = config({ rules: { "bold-density": "relaxed" } });
      assert.equal(withStyle(plain, styles), plain);
      const unknown = config({ style: "nope" });
      assert.equal(withStyle(unknown, styles), unknown);
    });
  });

  describe("the command line", () => {
    const REPORT = "# 報告\n\nサーバーを使います。\n";

    it("style: ieice checks with IEICE's way, without naming the rule", async () => {
      const run = await runCli({ "chaff.yaml": "language: ja\nstyle: ieice\n", "a.md": REPORT }, ["a.md", "--compact"]);
      assert.match(run.out, /「サーバー」は語末の「ー」を省いて「サーバ」と書きます（3 音以上の語）/u);
      assert.equal(run.code, 0);
    });

    it("style: bunkacho does not report サーバー", async () => {
      const run = await runCli({ "chaff.yaml": "language: ja\nstyle: bunkacho\n", "a.md": REPORT }, ["a.md", "--compact"]);
      assert.doesNotMatch(run.out, /katakana-long-vowel/u);
    });

    it("rules --json has no style field when chaff.yaml names none", async () => {
      const run = await runCli({ "chaff.yaml": "language: ja\n" }, ["rules", "--json"]);
      assert.doesNotMatch(run.out, /"style":/u);
    });

    it("an unknown style stops the run and lists the styles", async () => {
      const run = await runCli({ "chaff.yaml": "language: ja\nstyle: jis-z8301\n", "a.md": REPORT }, ["a.md"]);
      assert.equal(run.code, 1);
      assert.match(run.err, /jis-z8301/u);
      assert.match(run.err, /bunkacho, ieice, jis-z8301-2011/u);
    });

    it("explain and rules --json say the setting came from the style", async () => {
      const files = { "chaff.yaml": "language: ja\nstyle: ieice\noptions:\n  katakana-long-vowel:\n    min_morae: 4\n" };
      const explained = await runCli(files, ["explain", RULE]);
      assert.match(explained.out, /ending: drop {3}\(style: ieice から\)/u);
      assert.match(explained.out, /min_morae: 4 {3}\(chaff\.yaml から\)/u);
      const json = await runCli(files, ["rules", "--json"]);
      assert.match(json.out, /"style": \{\s*"id": "ieice"/u);
      assert.match(json.out, /"your_setting": \{\s*"level": "normal",\s*"from": "style: ieice"\s*\}/u);
      assert.match(json.out, /"now": "drop",\s*"from": "style: ieice"/u);
    });
  });
});
