import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { parseGenres, presetLevelsOf, withRuleOffs } from "../packages/chaff/src/genre-parse.ts";
import { IGNORE_MEASURED_OFFS_ENV, loadRuleOffs, MEASURED_OFF_REASON, offsInForce, ruleOffsOf } from "../packages/chaff/src/rule-offs.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";

// A rule a genre turns off says so in its own file (off_for), so that adding a rule edits no list every rule shares.

const localized = (text: string): { ja: string; en: string } => ({ ja: `${text}（ja）`, en: text });

const TOY = parseGenres({
  groups: [
    { id: "legal", name: localized("Legal"), rules: { "numbering-gap": "normal" } },
    { id: "blog", name: localized("Blog") },
  ],
  genres: [
    { id: "legal/contract", name: localized("Contract"), summary: localized("Contracts"), rules: { "back-on": "normal" } },
    { id: "legal/statute", name: localized("Statute"), summary: localized("Statutes") },
    { id: "blog/tech", name: localized("Tech"), summary: localized("Articles") },
  ],
});

const off = (rule: string, target: string): { rule: string; target: string; reason: string } => ({ rule, target, reason: "why" });

describe("off_for in a rule file", () => {
  it("reads each group or genre with its reason", () => {
    assert.deepEqual(ruleOffsOf("x", { legal: "Drafting does it on purpose.", "blog/tech": "Articles do." }), [
      { rule: "x", target: "legal", reason: "Drafting does it on purpose." },
      { rule: "x", target: "blog/tech", reason: "Articles do." },
    ]);
    assert.deepEqual(ruleOffsOf("x", undefined), []);
  });

  it("refuses an off without a reason, and a list in place of a map", () => {
    assert.throws(() => ruleOffsOf("x", { legal: "" }), /off_for\.legal needs a reason/u);
    assert.throws(() => ruleOffsOf("x", { legal: 3 }), /off_for\.legal needs a reason/u);
    assert.throws(() => ruleOffsOf("x", ["legal"]), /must map a group or genre/u);
  });

  it("is read from each rule file's own block, and a file without one gives none", () => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-rule-offs-"));
    try {
      writeFileSync(join(dir, "a-rule.yaml"), 'id: a-rule\nuse_for: [legal]\noff_for:\n  legal: "It is the form."\n  blog/tech: Articles do.\nsources: []\n');
      writeFileSync(join(dir, "b-rule.yaml"), "id: b-rule\nuse_for: [blog]\n");
      assert.deepEqual(loadRuleOffs(dir), [
        { rule: "a-rule", target: "legal", reason: "It is the form." },
        { rule: "a-rule", target: "blog/tech", reason: "Articles do." },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("off_for in a form the reader and --apply do not share", () => {
  const offsOf = (text: string): unknown => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-rule-offs-"));
    try {
      writeFileSync(join(dir, "a-rule.yaml"), text);
      return loadRuleOffs(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("refuses an inline map, a comment on the off_for line, and a second off_for", () => {
    [
      "id: a-rule\noff_for: { legal: why }\n",
      "id: a-rule\noff_for: # why\n  legal: why\n",
      "id: a-rule\noff_for:\n  legal: why\nsources: []\noff_for:\n  blog: why\n",
    ].forEach((text) => assert.throws(() => offsOf(text), /write off_for once/u, text));
  });

  it("reads a file checked out with CRLF line ends", () => {
    assert.deepEqual(offsOf("id: a-rule\r\noff_for:\r\n  legal: why\r\nsources: []\r\n"), [{ rule: "a-rule", target: "legal", reason: "why" }]);
  });

  it("every bundled rule file is named by its rule's id, which the offs are read by", () => {
    const dir = join(import.meta.dirname, "..", "packages", "chaff", "rules");
    const misnamed = loadRules("en", dir).flatMap((rule) => (existsSync(join(dir, `${rule.id}.yaml`)) ? [] : [rule.id]));
    assert.deepEqual(misnamed, []);
    assert.equal(loadRules("en", dir).length, readdirSync(dir).filter((file) => file.endsWith(".yaml")).length);
  });
});

describe("genres with the rules' offs merged in", () => {
  it("an off for a group reaches every genre in it, and an off for a genre that genre only", () => {
    const data = withRuleOffs(TOY, [off("ngram-repetition", "legal"), off("heading-echo", "legal/statute")]);
    assert.deepEqual(presetLevelsOf(data, "legal/contract"), { "numbering-gap": "normal", "ngram-repetition": "off", "back-on": "normal" });
    assert.deepEqual(presetLevelsOf(data, "legal/statute"), { "numbering-gap": "normal", "ngram-repetition": "off", "heading-echo": "off" });
    assert.deepEqual(presetLevelsOf(data, "blog/tech"), {});
  });

  it("a genre's own level still wins over its group's off", () => {
    assert.equal(presetLevelsOf(withRuleOffs(TOY, [off("back-on", "legal")]), "legal/contract")["back-on"], "normal");
  });

  it("refuses an off for no group or genre, and a level genres.yaml sets too", () => {
    assert.throws(() => withRuleOffs(TOY, [off("x", "legl")]), /x: off_for names legl, which is no group or genre/u);
    assert.throws(() => withRuleOffs(TOY, [off("numbering-gap", "legal")]), /numbering-gap: its off_for and genres\.yaml both set its level for legal/u);
  });

  it("genres.yaml itself turns no rule off: the rule files do", () => {
    const raw = parseGenres(parse(readFileSync(join(import.meta.dirname, "..", "packages", "chaff", "genres.yaml"), "utf8")));
    const offs = [...raw.groups, ...raw.genres].flatMap((entry) =>
      Object.entries(entry.rules).flatMap(([rule, level]) => (level === "off" ? [`${entry.id}: ${rule}`] : [])),
    );
    assert.deepEqual(offs, []);
  });
});

describe("measured offs, which yarn rules:precision runs without", () => {
  const offs = [
    { rule: "a", target: "legal", reason: MEASURED_OFF_REASON },
    { rule: "b", target: "legal", reason: "It is the form." },
  ];

  it("all hold, unless the measured ones are to be ignored; an off written by hand always holds", () => {
    assert.deepEqual(offsInForce(offs, false), offs);
    assert.deepEqual(offsInForce(offs, true), [offs[1]]);
    assert.deepEqual(offsInForce([], true), []);
    const nearMiss = { rule: "c", target: "blog", reason: `${MEASURED_OFF_REASON}, and by hand` };
    assert.deepEqual(offsInForce([nearMiss], true), [nearMiss]);
  });

  /** The bundled preset levels of these rules in a genre, read in a fresh process with CHAFF_IGNORE_MEASURED_OFFS set to `value`. */
  const presetOf = (value: string | undefined, genre: string, rules: readonly string[]): unknown => {
    const script = [
      'import { presetLevels } from "./packages/chaff/src/genre-load.ts";',
      `const levels = presetLevels(${JSON.stringify(genre)});`,
      `console.log(JSON.stringify(${JSON.stringify(rules)}.map((rule) => levels[rule] ?? null)));`,
    ].join("\n");
    const rest = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== IGNORE_MEASURED_OFFS_ENV));
    const env = value === undefined ? rest : { ...rest, [IGNORE_MEASURED_OFFS_ENV]: value };
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: join(import.meta.dirname, ".."), env, encoding: "utf8" });
    return JSON.parse(output);
  };

  // clause-chain is off for literature as measured; demonstrative-opener-run is off for it by hand.
  it("the bundled presets drop only the measured offs, and only when CHAFF_IGNORE_MEASURED_OFFS is 1", () => {
    const rules = ["clause-chain", "demonstrative-opener-run"];
    assert.deepEqual(presetOf(undefined, "literature/essay", rules), ["off", "off"]);
    assert.deepEqual(presetOf("0", "literature/essay", rules), ["off", "off"]);
    assert.deepEqual(presetOf("1", "literature/essay", rules), [null, "off"]);
  });
});
