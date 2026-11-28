import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { configOf, EMPTY, type Config } from "../packages/chaff/src/config/load.ts";
import type { PathRule } from "../packages/chaff/src/config/by-path.ts";
import { byPathSource, configForPath, entriesFor, mergePathRules, pathLevelsOf } from "../packages/chaff/src/config/by-path-rules.ts";
import { byPathRuleProblems } from "../packages/chaff/src/config/by-path-problems.ts";
import { optionLayersOf } from "../packages/chaff/src/config/option-problems.ts";
import { settingWarnings } from "../packages/chaff/src/config/warnings.ts";
import { withStyle } from "../packages/chaff/src/config/style.ts";
import { loadStyles } from "../packages/chaff/src/style-load.ts";
import { checkSource } from "../packages/chaff/src/check-source.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { renderExplain } from "../packages/chaff/src/render/explain.ts";
import { rulesJson } from "../packages/chaff/src/render/rules-json.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";

const BASE = "/proj";
const CONFIG_PATH = join(BASE, "chaff.yaml");
const at = (path: string): string => join(BASE, path);
const read = (raw: unknown): Config => configOf(raw, CONFIG_PATH);
const entry = (files: string[], rest: Partial<PathRule> = {}): PathRule => ({ files, genre: undefined, language: undefined, ...rest });

describe("by_path の rules を読む", () => {
  it("段階と数を、上の rules と同じ形で読む", () => {
    const config = read({ by_path: [{ files: "guides/**/*.md", rules: { "max-sentence-length": 80, "bold-density": "off" } }] });
    const [first] = config.byPath;
    assert.deepEqual(first?.rules, { "max-sentence-length": "normal", "bold-density": "off" });
    assert.deepEqual(first?.limits, { "max-sentence-length": 80 });
    assert.deepEqual(first?.unreadableRules, []);
    assert.deepEqual(config.unreadableByPath, []);
  });

  it("rules だけの項目も読める（genre も language も要らない）", () => {
    const config = read({ by_path: [{ files: ["a.md"], rules: { "bold-density": "strict" } }] });
    assert.equal(config.byPath.length, 1);
    assert.equal(config.byPath[0]?.genre, undefined);
  });

  it("段階として読めない値は捨てずに持つ", () => {
    const config = read({ by_path: [{ files: ["a.md"], rules: { "bold-density": "loose", x: -1, y: null, z: [1] } }] });
    assert.deepEqual(config.byPath[0]?.rules, {});
    assert.deepEqual(
      config.byPath[0]?.unreadableRules?.map((value) => value.id),
      ["bold-density", "x", "y", "z"],
    );
  });

  it("地図でない rules と options は読めないものとして持つ", () => {
    const config = read({ by_path: [{ files: ["a.md"], rules: "off", options: [1] }] });
    assert.deepEqual(config.byPath[0]?.unreadableBlocks, [
      { key: "rules", value: '"off"' },
      { key: "options", value: "[1]" },
    ]);
    assert.deepEqual(config.byPath[0]?.rules, {});
    assert.deepEqual(config.byPath[0]?.options, {});
  });

  it("rules と options を書かなければ、何も足さない", () => {
    const config = read({ by_path: [{ files: ["a.md"], genre: "docs/manual", rules: null }] });
    assert.equal(config.byPath[0]?.rules, undefined);
    assert.equal(config.byPath[0]?.unreadableBlocks, undefined);
  });

  it("files の無い項目は、rules があっても読めない", () => {
    const config = read({ by_path: [{ rules: { "bold-density": "off" } }] });
    assert.deepEqual(config.byPath, []);
    assert.equal(config.unreadableByPath?.length, 1);
  });
});

describe("当たる項目を重ねる", () => {
  it("何も当たらなければ空", () => {
    assert.deepEqual(mergePathRules([]), { rules: {}, limits: {}, levelsFrom: {}, optionLayers: [] });
  });

  it("後に書いた項目が勝つ", () => {
    const merged = mergePathRules([entry(["**/*.md"], { rules: { a: "off" } }), entry(["x/*.md"], { rules: { a: "strict" } })]);
    assert.deepEqual(merged.rules, { a: "strict" });
    assert.deepEqual(merged.levelsFrom, { a: "by_path: x/*.md" });
  });

  it("後の段階は、前の数を消す", () => {
    const merged = mergePathRules([entry(["a"], { rules: { a: "normal" }, limits: { a: 80 } }), entry(["b"], { rules: { a: "relaxed" } })]);
    assert.deepEqual(merged.rules, { a: "relaxed" });
    assert.deepEqual(merged.limits, {});
  });

  it("後の数は、前の段階に勝つ", () => {
    const merged = mergePathRules([entry(["a"], { rules: { a: "off" } }), entry(["b"], { rules: { a: "normal" }, limits: { a: 12 } })]);
    assert.deepEqual(merged.rules, { a: "normal" });
    assert.deepEqual(merged.limits, { a: 12 });
  });

  it("別の rule には触らない", () => {
    const merged = mergePathRules([entry(["a"], { rules: { a: "normal" }, limits: { a: 80 } }), entry(["b"], { rules: { b: "off" } })]);
    assert.deepEqual(merged.rules, { a: "normal", b: "off" });
    assert.deepEqual(merged.limits, { a: 80 });
  });

  it("options は後の項目ほど強い（先頭が最も強い）", () => {
    const merged = mergePathRules([entry(["a"], { options: { r: { x: 1 } } }), entry(["b"], { options: {} }), entry(["c"], { options: { r: { x: 2 } } })]);
    assert.deepEqual(
      merged.optionLayers.map((layer) => layer.from),
      ["by_path: c", "by_path: a"],
    );
  });

  it("当たる項目だけを、書いた順に選ぶ", () => {
    const byPath = [entry(["guides/**/*.md"]), entry(["blog/*.md"]), entry(["guides/b.md", "x.md"])];
    assert.deepEqual(entriesFor(byPath, BASE, at("guides/b.md")).map(byPathSource), ["by_path: guides/**/*.md", "by_path: guides/b.md, x.md"]);
    assert.deepEqual(entriesFor(byPath, BASE, at("other.md")), []);
  });
});

describe("1 つのファイルの設定", () => {
  const raw = {
    rules: { "max-sentence-length": 200, "bold-density": "strict" },
    options: { "max-kanji-continuous": { allow: ["a"] } },
    by_path: [
      { files: "guides/**/*.md", rules: { "max-sentence-length": "relaxed" }, options: { "max-kanji-continuous": { allow: ["b"] } } },
      { files: "guides/b.md", rules: { "bold-density": "off" } },
    ],
  };

  it("当たらないファイルは、書いたままの設定（同じもの）を使う", () => {
    const config = read(raw);
    assert.equal(configForPath(config, at("blog/a.md")), config);
  });

  it("by_path の rules は上の rules に勝ち、上の数も消す", () => {
    const config = configForPath(read(raw), at("guides/a.md"));
    assert.equal(config.rules["max-sentence-length"], "relaxed");
    assert.equal(config.limits["max-sentence-length"], undefined);
    assert.equal(config.rules["bold-density"], "strict");
    assert.deepEqual(config.pathLevelsFrom, { "max-sentence-length": "by_path: guides/**/*.md" });
  });

  it("複数当たれば後の項目が勝ち、前の項目の設定も残る", () => {
    const config = configForPath(read(raw), at("guides/b.md"));
    assert.equal(config.rules["bold-density"], "off");
    assert.equal(config.rules["max-sentence-length"], "relaxed");
    assert.deepEqual(config.pathLevelsFrom, { "max-sentence-length": "by_path: guides/**/*.md", "bold-density": "by_path: guides/b.md" });
  });

  it("options は by_path、chaff.yaml の順に強い", () => {
    const config = configForPath(read(raw), at("guides/a.md"));
    assert.deepEqual(
      optionLayersOf(config).map((layer) => layer.from),
      ["by_path: guides/**/*.md", "chaff.yaml"],
    );
  });

  it("style が決めた段階と数にも勝ち、その rule は style の出どころから外れる", () => {
    const style = loadStyles().find((entry) => Object.keys(entry.limits).length > 0);
    assert.ok(style, "a bundled style with numbers");
    const id = Object.keys(style.limits)[0] ?? "";
    const styled = withStyle(read({ style: style.id, by_path: [{ files: "x/*.md", rules: { [id]: "off" } }] }), loadStyles());
    assert.ok(styled.applied?.levelsFrom.includes(id));
    const config = configForPath(styled, at("x/a.md"));
    assert.equal(config.rules[id], "off");
    assert.equal(config.applied?.levelsFrom.includes(id), false);
    assert.equal(config.applied?.limits[id], undefined);
  });

  it("explain と rules --json 向けに、rule を変える項目を書いた順に返す", () => {
    const config = read({
      by_path: [
        { files: "a/*", rules: { r: 30 } },
        { files: "b/*", rules: { s: "off" } },
        { files: "c/*", rules: { r: "off" } },
      ],
    });
    assert.deepEqual(pathLevelsOf(config.byPath, "r"), [
      { files: ["a/*"], level: "normal", limit: 30 },
      { files: ["c/*"], level: "off" },
    ]);
    assert.deepEqual(pathLevelsOf(config.byPath, "none"), []);
    assert.deepEqual(pathLevelsOf(EMPTY.byPath, "r"), []);
  });
});

describe("効いていない by_path の rules を言う", () => {
  const rules = loadRules("en");

  it("知らない rule と読めない値を、項目の名前つきで言う（ja / en）", () => {
    const config = read({ by_path: [{ files: "g/*.md", rules: { "max-sentense-length": "strict", "bold-density": "loose" } }] });
    const en = byPathRuleProblems(config, rules, "en");
    assert.equal(en.length, 2);
    assert.match(en[0] ?? "", /\(by_path: g\/\*\.md\): there is no rule named max-sentense-length/u);
    assert.match(en[1] ?? "", /cannot read "loose" as the level of bold-density/u);
    const ja = byPathRuleProblems(config, rules, "ja");
    assert.match(ja[0] ?? "", /\(by_path: g\/\*\.md\): max-sentense-length というルールはありません/u);
  });

  it("地図でない rules と options を言う", () => {
    const config = read({ by_path: [{ files: "g/*.md", rules: "off", options: 7 }] });
    const en = byPathRuleProblems(config, rules, "en");
    assert.match(en[0] ?? "", /cannot read "off" under rules/u);
    assert.match(en[1] ?? "", /cannot read 7 under options/u);
    assert.match(byPathRuleProblems(config, rules, "ja")[0] ?? "", /rules の "off" は読めません/u);
  });

  it("options の知らない rule を言う", () => {
    const config = read({ by_path: [{ files: "g/*.md", options: { "no-such-rule": { x: 1 } } }] });
    assert.match(byPathRuleProblems(config, rules, "en")[0] ?? "", /there is no rule named no-such-rule under options/u);
  });

  it("正しく書いた項目には何も言わない", () => {
    const config = read({ by_path: [{ files: "g/*.md", genre: "docs/manual", rules: { "bold-density": "off", "max-sentence-length": 40 } }] });
    assert.deepEqual(byPathRuleProblems(config, rules, "en"), []);
    assert.deepEqual(byPathRuleProblems(EMPTY, rules, "en"), []);
  });

  it("実行前の警告にも入る", () => {
    const config = read({ by_path: [{ files: "g/*.md", rules: { nope: "off" } }] });
    assert.ok(settingWarnings(config, rules, "en").some((warning) => warning.includes("(by_path: g/*.md): there is no rule named nope")));
  });
});

describe("by_path で止めた rule は、動かなかった理由にそう出る", () => {
  const SENTENCE = "This sentence has enough words in it to pass a very small limit that a team might set.\n";

  it("当たるファイルでは止まり、理由に項目が出る（en）", async () => {
    const config = read({ language: "en", rules: { "max-sentence-length": 3 }, by_path: [{ files: "guides/*.md", rules: { "max-sentence-length": "off" } }] });
    const check = await checkSource(at("guides/a.md"), SENTENCE, config, { experimental: false });
    assert.equal(
      check.raw.findings.some((finding) => finding.rule === "max-sentence-length"),
      false,
    );
    const skipped = check.raw.skipped.find((entry) => entry.rule === "max-sentence-length");
    assert.equal(skipped?.why, REASONS.en.turnedOffBy("by_path: guides/*.md"));
  });

  it("当たらないファイルでは上の rules のまま動く", async () => {
    const config = read({ language: "en", rules: { "max-sentence-length": 3 }, by_path: [{ files: "guides/*.md", rules: { "max-sentence-length": "off" } }] });
    const check = await checkSource(at("blog/a.md"), SENTENCE, config, { experimental: false });
    assert.ok(check.raw.findings.some((finding) => finding.rule === "max-sentence-length"));
  });

  it("上の rules で止めたものは、これまでどおり「設定で止めている」", async () => {
    const config = read({ language: "en", rules: { "max-sentence-length": "off" } });
    const check = await checkSource(at("a.md"), SENTENCE, config, { experimental: false });
    assert.equal(check.raw.skipped.find((entry) => entry.rule === "max-sentence-length")?.why, REASONS.en.turnedOff);
  });

  it("日本語の文書では日本語で言う", async () => {
    const config = read({ by_path: [{ files: "ja/*.md", rules: { "max-sentence-length": "off" } }] });
    const check = await checkSource(at("ja/a.md"), "これは短い文です。\n", config, { experimental: false });
    assert.equal(check.raw.skipped.find((entry) => entry.rule === "max-sentence-length")?.why, "設定の by_path: ja/*.md で止めているため");
  });

  it("by_path の数は、そのファイルだけの上限になる", async () => {
    const config = read({ language: "en", by_path: [{ files: "tight/*.md", rules: { "max-sentence-length": 3 } }] });
    const tight = await checkSource(at("tight/a.md"), SENTENCE, config, { experimental: false });
    const loose = await checkSource(at("a.md"), SENTENCE, config, { experimental: false });
    assert.ok(tight.raw.findings.some((finding) => finding.rule === "max-sentence-length"));
    assert.equal(
      loose.raw.findings.some((finding) => finding.rule === "max-sentence-length"),
      false,
    );
  });
});

describe("explain と rules --json は by_path の設定を見せる", () => {
  const rules = loadRules("en");
  const rule = rules.find((entry) => entry.id === "max-sentence-length");
  const config = read({
    by_path: [
      { files: "guides/**/*.md", rules: { "max-sentence-length": "off" } },
      { files: "b.md", rules: { "max-sentence-length": 9 } },
    ],
  });

  it("explain は項目と段階・数を並べる（en / ja）", () => {
    assert.ok(rule);
    const byPath = pathLevelsOf(config.byPath, rule.id);
    const en = renderExplain(rule, "normal", "en", undefined, { byPath });
    assert.match(en, /by_path in chaff\.yaml changes it for these files/u);
    assert.match(en, /guides\/\*\*\/\*\.md: off/u);
    assert.match(en, /b\.md: 9/u);
    assert.match(renderExplain(rule, "normal", "ja", undefined, { byPath }), /chaff\.yaml の by_path で、次のファイルだけ変えています/u);
  });

  it("explain は by_path が無ければ何も足さない", () => {
    assert.ok(rule);
    assert.doesNotMatch(renderExplain(rule, "normal", "en", undefined, { byPath: [] }), /by_path/u);
  });

  it("rules --json は rule ごとに by_path を出し、触れない rule には出さない", () => {
    const json: unknown = JSON.parse(rulesJson(rules, config, "en", "blog/tech"));
    assert.ok(typeof json === "object" && json !== null && "rules" in json && Array.isArray(json.rules));
    const entries: unknown[] = json.rules;
    const find = (id: string): Record<string, unknown> | undefined => {
      const found = entries.find((value) => typeof value === "object" && value !== null && "id" in value && value.id === id);
      return typeof found === "object" && found !== null ? Object.fromEntries(Object.entries(found)) : undefined;
    };
    assert.deepEqual(find("max-sentence-length")?.["by_path"], [
      { files: ["guides/**/*.md"], level: "off", from: "by_path: guides/**/*.md" },
      { files: ["b.md"], level: "normal", limit: 9, from: "by_path: b.md" },
    ]);
    assert.equal(find("bold-density")?.["by_path"], undefined);
  });
});
