import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { packNameOf, packageOf } from "../packages/chaff/src/commands/plugin-init.ts";
import { parseCustomRules } from "../packages/chaff/src/custom/parse.ts";
import { customProblemSentence } from "../packages/chaff/src/custom/problems.ts";
import { knownGenres } from "../packages/chaff/src/known-genres.ts";
import { runCli } from "./cli-run.ts";

// chaff init --plugin <name> makes a YAML rule pack to start from; chaff plugin-test runs each rule of a plugin on the
// rule's own example. Both samples in examples/ go through plugin-test here, so neither can rot.

const EXAMPLES = join(import.meta.dirname, "..", "examples");

describe("init --plugin — the name", () => {
  it("takes a plain name or a scoped one, with or without chaff-plugin- in front", () => {
    assert.deepEqual(packNameOf("house"), { scope: undefined, name: "house" });
    assert.deepEqual(packNameOf("chaff-plugin-house"), { scope: undefined, name: "house" });
    assert.deepEqual(packNameOf("@team/house"), { scope: "@team", name: "house" });
    assert.deepEqual(packNameOf("@team/chaff-plugin-house"), { scope: "@team", name: "house" });
    assert.deepEqual(packageOf({ scope: "@team", name: "house" }), { packageName: "@team/chaff-plugin-house", folder: "chaff-plugin-house" });
  });

  it("refuses what cannot be a plugin's name", () => {
    ["", "House", "two words", "../house", "@/house", "house/", "1house", undefined].forEach((written) => {
      assert.equal(packNameOf(written), undefined, String(written));
    });
  });
});

describe("init --plugin — the pack it makes", () => {
  it("makes one rule with its word list in Japanese and English, and the pack passes its own test", async () => {
    const made = await runCli({}, ["init", "--plugin", "house"], "en_US.UTF-8");
    assert.equal(made.code, 0, made.err);
    const folder = join(made.dir, "chaff-plugin-house");
    ["package.json", "rules/avoid-words.yaml", "lexicons/ja/avoid-words.yaml", "lexicons/en/avoid-words.yaml"].forEach((path) => {
      assert.ok(existsSync(join(folder, path)), path);
    });
    const manifest: unknown = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
    assert.ok(typeof manifest === "object" && manifest !== null && "scripts" in manifest);
    assert.match(JSON.stringify(manifest.scripts), /chaffjs plugin-test \./u);
    const tested = await runCli({}, ["plugin-test", folder], "en_US.UTF-8");
    assert.equal(tested.code, 0, tested.err);
    assert.match(tested.out, /✓ house\/avoid-words \(ja\)\n {2}✓ house\/avoid-words \(en\)\n\n2 of 2 passed\./u);
  });

  it("does not overwrite a folder that is there, and refuses a bad name", async () => {
    const there = await runCli({ "chaff-plugin-house/keep.txt": "mine\n" }, ["init", "--plugin", "house"], "en_US.UTF-8");
    assert.equal(there.code, 1);
    assert.match(there.err, /chaff-plugin-house already exists/u);
    assert.equal(readFileSync(join(there.dir, "chaff-plugin-house", "keep.txt"), "utf8"), "mine\n");
    const bad = await runCli({}, ["init", "--plugin", "House"], "ja_JP.UTF-8");
    assert.equal(bad.code, 1);
    assert.match(bad.err, /--plugin House: プラグインの名前は英小文字/u);
  });
});

describe("plugin-test — both samples in examples/", () => {
  it("passes the YAML pack, every rule in every language", async () => {
    const run = await runCli({}, ["plugin-test", join(EXAMPLES, "chaff-plugin-clear-requests")], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /\n4 of 4 passed\./u);
  });

  it("passes the code plugin, every rule in every language", async () => {
    const run = await runCli({}, ["plugin-test", join(EXAMPLES, "chaff-plugin-example")], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /✓ example\/no-tbd-dates \(ja\)/u);
    assert.match(run.out, /\n4 of 4 passed\./u);
  });
});

describe("plugin-test — a pack that fails", () => {
  const MANIFEST = { "pack/chaff-plugin.yaml": "name: house\n" };
  const RULE = [
    "id: avoid-words",
    "type: words",
    "word_list: avoid-words",
    "name: A word the team does not use",
    "why: The team calls each thing by one word.",
    "how_to_fix: Use the team's word.",
    "example:",
    "  en: { before: We utilize it., after: We utilize it. }",
    "",
  ].join("\n");

  it("fails a rule whose after is still flagged, and one with no word list in its example's language", async () => {
    const files = { ...MANIFEST, "pack/rules/avoid-words.yaml": RULE, "pack/lexicons/en/avoid-words.yaml": "- utilize\n" };
    const flagged = await runCli(files, ["plugin-test", "pack"], "en_US.UTF-8");
    assert.equal(flagged.code, 1);
    assert.match(flagged.out, /✗ house\/avoid-words \(en\): the example's after gets 1 finding/u);
    const noList = await runCli(
      { ...MANIFEST, "pack/rules/avoid-words.yaml": RULE, "pack/lexicons/ja/avoid-words.yaml": "- 弊社\n" },
      ["plugin-test", "pack"],
      "en_US.UTF-8",
    );
    assert.equal(noList.code, 1);
    assert.match(noList.out, /✗ house\/avoid-words \(en\): it does not run \(the plugin house has no en word list avoid-words\)/u);
  });

  it("says so when there is no rule, and when the plugin cannot be loaded", async () => {
    const empty = await runCli(MANIFEST, ["plugin-test", "pack"], "en_US.UTF-8");
    assert.equal(empty.code, 1);
    assert.match(empty.err, /has no rules/u);
    const broken = await runCli({ ...MANIFEST, "pack/rules/a.yaml": "id: [\n" }, ["plugin-test", "pack"], "en_US.UTF-8");
    assert.equal(broken.code, 1);
    assert.match(broken.err, /cannot load it \(rules\/a\.yaml: /u);
  });
});

describe("rule DSL — a text cut by a comma in a YAML flow map", () => {
  it("reports the stray key instead of keeping half the text", () => {
    const raw: unknown = parse("how_to_fix: { ja: 日付を書きます。, en: Write a date, or a number of days. }\n");
    const howToFix = typeof raw === "object" && raw !== null && "how_to_fix" in raw ? raw.how_to_fix : undefined;
    const rule = {
      id: "vague",
      type: "words",
      words: ["soon"],
      name: "Vague",
      why: "Why",
      how_to_fix: howToFix,
      example: { before: "Soon.", after: "By May." },
    };
    const parsed = parseCustomRules([rule], { builtIn: new Set(), useFor: ["business"], genres: knownGenres(), baseDir: "/p" });
    assert.deepEqual(
      parsed.problems.map((problem) => problem.kind),
      ["bad-text"],
    );
    const [problem] = parsed.problems;
    assert.ok(problem !== undefined);
    assert.match(customProblemSentence(problem, "en"), /how_to_fix: "or a number of days\." is not a language/u);
    const quoted = parseCustomRules([{ ...rule, how_to_fix: { en: "Write a date, or a number of days." } }], {
      builtIn: new Set(),
      useFor: ["business"],
      genres: knownGenres(),
      baseDir: "/p",
    });
    assert.deepEqual(quoted.problems, []);
  });
});
