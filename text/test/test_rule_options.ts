import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fitsOption, optionProblems, optionsOf, settleOptions, type OptionLayer } from "../packages/chaff/src/rule-options.ts";
import { loadConfig } from "../packages/chaff/src/config/read.ts";
import { configOptionProblems } from "../packages/chaff/src/config/option-problems.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runCli } from "./cli-run.ts";

const ABOUT = { ja: "向き", en: "direction" };
const DECLARED = {
  ending: { kind: "choice", default: "a", about: ABOUT, choices: { a: { en: "A" }, b: { ja: "B" } } },
  size: { kind: "count", default: 3, about: ABOUT },
  words: { kind: "words", about: ABOUT },
};
const OPTIONS = optionsOf(DECLARED, "r.yaml");

const tmpConfig = (body: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "chaff-")), "chaff.yaml");
  writeFileSync(path, body, "utf8");
  return path;
};

describe("rule options", () => {
  describe("optionsOf reads what a rule declares", () => {
    it("reads each kind, a words option defaulting to an empty list", () => {
      assert.deepEqual(Object.keys(OPTIONS), ["ending", "size", "words"]);
      assert.deepEqual(OPTIONS["ending"]?.choices, ["a", "b"]);
      assert.deepEqual(OPTIONS["words"]?.default, []);
      assert.equal(OPTIONS["size"]?.default, 3);
    });

    const bad: readonly (readonly [string, unknown, RegExp])[] = [
      ["not a map", [1], /options must be a map/u],
      ["an unknown kind", { x: { kind: "colour", about: ABOUT } }, /kind must be one of/u],
      ["no about", { x: { kind: "count", default: 1 } }, /about needs/u],
      ["one choice", { x: { kind: "choice", default: "a", about: ABOUT, choices: { a: ABOUT } } }, /two or more choices/u],
      ["a choice without its meaning", { x: { kind: "choice", default: "a", about: ABOUT, choices: { a: ABOUT, b: "" } } }, /choice b needs/u],
      ["a default not among the choices", { x: { kind: "choice", default: "c", about: ABOUT, choices: { a: ABOUT, b: ABOUT } } }, /default must be a \/ b/u],
      ["a count default of 0", { x: { kind: "count", default: 0, about: ABOUT } }, /default must be count/u],
      ["no count default", { x: { kind: "count", about: ABOUT } }, /default must be count/u],
    ];
    const namesTheFile =
      (message: RegExp) =>
      (error: unknown): boolean =>
        error instanceof Error && error.message.startsWith("r.yaml") && message.test(error.message);
    const reading = (raw: unknown) => (): unknown => optionsOf(raw, "r.yaml");
    bad.forEach(([what, raw, message]) => {
      it(`throws on ${what}, naming the file`, () => {
        assert.throws(reading(raw), namesTheFile(message));
      });
    });

    it("no options declared is an empty map", () => {
      assert.deepEqual(optionsOf(undefined, "r.yaml"), {});
    });
  });

  describe("fitsOption", () => {
    const cases: readonly (readonly [string, unknown, boolean])[] = [
      ["ending", "b", true],
      ["ending", "c", false],
      ["ending", 1, false],
      ["size", 2, true],
      ["size", 0, false],
      ["size", 2.5, false],
      ["size", "3", false],
      ["words", ["カー"], true],
      ["words", [], true],
      ["words", ["", "カー"], false],
      ["words", "カー", false],
      ["words", [1], false],
    ];
    cases.forEach(([name, value, fits]) => {
      it(`${name} ${JSON.stringify(value)} ${fits ? "fits" : "does not fit"}`, () => {
        const option = OPTIONS[name];
        assert.ok(option !== undefined);
        assert.equal(fitsOption(option, value), fits);
      });
    });
  });

  describe("settleOptions: the strongest layer with a fitting value wins", () => {
    const layers: OptionLayer[] = [
      { from: "chaff.yaml", values: { r: { ending: "wrong", size: 5 } } },
      { from: "style ieice", values: { r: { ending: "b", size: 4 } } },
    ];

    it("each option from where it was set, a bad value falling through, the rest at the default", () => {
      assert.deepEqual(settleOptions("r", OPTIONS, layers), {
        ending: { value: "b", from: "style ieice" },
        size: { value: 5, from: "chaff.yaml" },
        words: { value: [], from: "default" },
      });
    });

    it("no layers: every option at its default", () => {
      assert.deepEqual(settleOptions("r", OPTIONS, []).ending, { value: "a", from: "default" });
    });

    it("another rule's values do not apply", () => {
      assert.equal(settleOptions("s", OPTIONS, layers).size?.from, "default");
    });
  });

  describe("optionProblems names what changes nothing", () => {
    it("an unknown rule, a rule without options, a non-map, an unknown option, a bad value", () => {
      const layer: OptionLayer = {
        from: "chaff.yaml",
        values: { nope: { a: 1 }, plain: { a: 1 }, r: { ending: "c", colour: 1, size: 4 }, q: 3 },
      };
      assert.deepEqual(
        optionProblems(layer, { plain: {}, r: OPTIONS, q: OPTIONS }).map((problem) => `${problem.kind}:${problem.rule}`),
        ["unknown-rule:nope", "no-options:plain", "bad-value:r", "unknown-option:r", "not-a-map:q"],
      );
    });

    it("nothing wrong, nothing said", () => {
      assert.deepEqual(optionProblems({ from: "x", values: { r: { ending: "b" } } }, { r: OPTIONS }), []);
    });
  });

  describe("chaff.yaml's options", () => {
    const rules = loadRules("ja");

    it("reads the map as written", () => {
      const config = loadConfig(tmpConfig("options:\n  katakana-long-vowel:\n    ending: drop\n    min_morae: 3\n"));
      assert.deepEqual(config.options, { "katakana-long-vowel": { ending: "drop", min_morae: 3 } });
      assert.deepEqual(configOptionProblems(config, rules, "en"), []);
    });

    it("says what does not apply, in the ui language", () => {
      const config = loadConfig(tmpConfig("options:\n  katakana-long-vowel:\n    ending: sometimes\n  bold-density:\n    size: 3\n"));
      const problems = configOptionProblems(config, rules, "ja");
      assert.equal(problems.length, 2);
      assert.match(problems[0] ?? "", /ending の値 "sometimes" は読めません（consistent \/ drop \/ keep）/u);
      assert.match(problems[1] ?? "", /bold-density にはオプションがありません/u);
    });

    it("options that are not a map are said once", () => {
      const config = loadConfig(tmpConfig("options: drop\n"));
      assert.deepEqual(config.options, {});
      assert.match(configOptionProblems(config, rules, "en")[0] ?? "", /cannot read "drop" under options/u);
    });

    it("no options: nothing", () => {
      assert.deepEqual(loadConfig(tmpConfig("genre: blog/tech\n")).options, {});
    });
  });

  describe("the command line", () => {
    const CONFIG = "language: ja\nrules:\n  katakana-long-vowel: normal\noptions:\n  katakana-long-vowel:\n    ending: drop\n";

    it("lint checks against the option chaff.yaml sets", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG, "a.md": "# 報告\n\nサーバーを使います。\n" }, ["a.md", "--compact"]);
      assert.match(run.out, /「サーバー」は語末の「ー」を省いて「サーバ」と書きます（2 音以上の語）/u);
    });

    it("explain shows each option's value and where it came from", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG }, ["explain", "katakana-long-vowel"]);
      assert.match(run.out, /ending: drop {3}\(.*chaff\.yaml から\)/u);
      assert.match(run.out, /min_morae: 2 {3}\(既定\)/u);
      assert.match(run.out, /→ drop/u);
    });

    it("rules --json carries the options with now and from", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG }, ["rules", "--json"]);
      const parsed: unknown = JSON.parse(run.out);
      assert.ok(typeof parsed === "object" && parsed !== null && "rules" in parsed && Array.isArray(parsed.rules));
      const rule: unknown = parsed.rules.find(
        (entry: unknown) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === "katakana-long-vowel",
      );
      assert.ok(typeof rule === "object" && rule !== null && "options" in rule);
      const options = JSON.stringify(rule.options);
      assert.match(options, /"ending":\{"kind":"choice".*"default":"consistent","now":"drop","from":"[^"]*chaff\.yaml"/u);
    });

    it("a bad option is said on stderr and the run goes on", async () => {
      const run = await runCli({ "chaff.yaml": "language: ja\noptions:\n  katakana-long-vowel:\n    min_morae: 0\n", "a.md": "# 報告\n\n本文です。\n" }, [
        "a.md",
        "--compact",
      ]);
      assert.match(run.err, /min_morae の値 0 は読めません（count）/u);
      assert.equal(run.code, 0);
    });
  });
});
