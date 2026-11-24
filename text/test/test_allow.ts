import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowFor, allowOf, applyAllow, type AllowEntry } from "../packages/chaff/src/allow.ts";
import { allowProblems, allowRuleWarnings } from "../packages/chaff/src/config/allow-problems.ts";
import { renderSuppressions } from "../packages/chaff/src/render/suppressions.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

const at = (rule: string, offset: number): Finding => ({ rule, severity: "warning", line: 1, column: offset + 1, quote: "", values: { offset } });

const entry = (fields: Partial<AllowEntry>): AllowEntry => ({ at: "allow[0]", reason: "why", rules: [], files: [], ...fields });

const kinds = (raw: unknown): string[] => allowOf(raw).problems.map((problem) => problem.kind);

describe("allow: reading chaff.yaml", () => {
  it("reads a literal and a pattern entry, with rules and files", () => {
    const read = allowOf([
      { text: "Kubernetes", reason: "product name" },
      { pattern: "v\\d+\\.\\d+", reason: "version numbers", rules: ["spelling"], files: "docs/**/*.md" },
    ]);
    assert.deepEqual(read.problems, []);
    assert.equal(read.entries[0]?.text, "Kubernetes");
    assert.deepEqual(read.entries[1]?.rules, ["spelling"]);
    assert.deepEqual(read.entries[1]?.files, ["docs/**/*.md"]);
    assert.equal(read.entries[1]?.pattern, "v\\d+\\.\\d+");
  });

  it("nothing written is nothing allowed, with no problem", () => {
    assert.deepEqual(allowOf(undefined), { entries: [], problems: [] });
    assert.deepEqual(allowOf(null), { entries: [], problems: [] });
  });

  it("an entry without a reason is a problem, not an allowance", () => {
    assert.deepEqual(kinds([{ text: "Kubernetes" }]), ["no-reason"]);
    assert.deepEqual(kinds([{ text: "Kubernetes", reason: "  " }]), ["no-reason"]);
    assert.deepEqual(allowOf([{ text: "Kubernetes" }]).entries, []);
  });

  it("names each other malformed shape", () => {
    assert.deepEqual(kinds("Kubernetes"), ["not-a-list"]);
    assert.deepEqual(kinds(["Kubernetes"]), ["not-a-map"]);
    assert.deepEqual(kinds([{ reason: "x" }]), ["no-target"]);
    assert.deepEqual(kinds([{ text: "", reason: "x" }]), ["no-target"]);
    assert.deepEqual(kinds([{ text: "a", pattern: "b", reason: "x" }]), ["both-targets"]);
    assert.deepEqual(kinds([{ text: "a", reason: "x", rules: { spelling: true } }]), ["bad-rules"]);
    assert.deepEqual(kinds([{ text: "a", reason: "x", rules: ["spelling", 3] }]), ["bad-rules"]);
    assert.deepEqual(kinds([{ text: "a", reason: "x", files: 7 }]), ["bad-files"]);
  });

  it("refuses a pattern that can run away or match nothing", () => {
    assert.deepEqual(kinds([{ pattern: "(a+)+", reason: "x" }]), ["bad-pattern"]);
    assert.deepEqual(kinds([{ pattern: "a*", reason: "x" }]), ["bad-pattern"]);
    assert.deepEqual(kinds([{ pattern: "(", reason: "x" }]), ["bad-pattern"]);
  });

  it("says each problem in Japanese and English, naming the entry", () => {
    const config = { allow: [{ text: "a" }, { pattern: "(a+)+", reason: "x" }], path: "chaff.yaml" };
    const ja = allowProblems(config, "ja");
    const en = allowProblems(config, "en");
    assert.match(ja[0] ?? "", /allow\[0\]: reason がありません/u);
    assert.match(ja[1] ?? "", /allow\[1\]: pattern を使えません。繰り返しの中に繰り返し/u);
    assert.match(en[0] ?? "", /allow\[0\]: reason is missing/u);
    assert.match(en[1] ?? "", /allow\[1\]: the pattern cannot be used: it repeats something that repeats/u);
  });

  it("warns about a rule id chaff does not have, and not about one it has", () => {
    const config = { allow: [{ text: "a", reason: "x", rules: ["spelling", "no-such-rule"] }], path: "chaff.yaml" };
    const warned = allowRuleWarnings(config, [{ id: "spelling" }], "en");
    assert.equal(warned.length, 1);
    assert.match(warned[0] ?? "", /no-such-rule/u);
  });
});

describe("allow: which files an entry covers", () => {
  it("an entry without files covers every file; with files, only the matching ones", () => {
    const everywhere = entry({});
    const docs = entry({ at: "allow[1]", files: ["docs/**/*.md"] });
    assert.deepEqual(
      allowFor([everywhere, docs], "/repo", "/repo/docs/a/b.md").map((value) => value.at),
      ["allow[0]", "allow[1]"],
    );
    assert.deepEqual(
      allowFor([everywhere, docs], "/repo", "/repo/notes/b.md").map((value) => value.at),
      ["allow[0]"],
    );
  });
});

describe("allow: which findings it drops", () => {
  const source = "We run Kubernetes and kubectl on every node.";
  const offset = source.indexOf("Kubernetes");

  it("drops a finding placed inside an allowed literal, and keeps one outside it", () => {
    const applied = applyAllow(source, [at("spelling", offset + 2), at("spelling", source.indexOf("kubectl"))], [entry({ text: "Kubernetes" })]);
    assert.deepEqual(
      applied.kept.map((finding) => finding.values["offset"]),
      [source.indexOf("kubectl")],
    );
    assert.equal(applied.allowed[0]?.entry.reason, "why");
  });

  it("a finding just past the allowed text is kept", () => {
    assert.equal(applyAllow(source, [at("spelling", offset + "Kubernetes".length)], [entry({ text: "Kubernetes" })]).kept.length, 1);
  });

  it("matches a literal exactly, so a different case is not allowed", () => {
    assert.equal(applyAllow(source, [at("spelling", offset)], [entry({ text: "kubernetes" })]).kept.length, 1);
  });

  it("drops only the rules an entry names", () => {
    const applied = applyAllow(source, [at("spelling", offset), at("word-repeat", offset)], [entry({ text: "Kubernetes", rules: ["spelling"] })]);
    assert.deepEqual(
      applied.kept.map((finding) => finding.rule),
      ["word-repeat"],
    );
  });

  it("drops a finding inside a pattern's match", () => {
    const text = "Upgrade to v12.4 before Friday.";
    const applied = applyAllow(text, [at("spelling", text.indexOf("v12")), at("spelling", text.indexOf("Friday"))], [entry({ pattern: "v\\d+\\.\\d+" })]);
    assert.equal(applied.allowed.length, 1);
    assert.equal(applied.kept.length, 1);
  });

  it("a finding about the whole document (no place) is never allowed", () => {
    const whole: Finding = { rule: "spelling", severity: "warning", line: 0, column: 0, quote: "", values: {} };
    assert.equal(applyAllow(source, [whole], [entry({ pattern: "." })]).kept.length, 1);
  });

  it("places a finding without an offset by its line and column", () => {
    const text = "first line\nWe run Kubernetes.";
    const placed: Finding = { rule: "spelling", severity: "warning", line: 2, column: 8, quote: "", values: {} };
    assert.equal(applyAllow(text, [placed], [entry({ text: "Kubernetes" })]).allowed.length, 1);
  });
});

describe("allow: chaff suppressions lists what it silenced", () => {
  it("shows each entry with its count and reason, in both languages", () => {
    const allowed = [{ finding: at("spelling", 0), entry: entry({ text: "Kubernetes", reason: "product name", rules: ["spelling"] }) }];
    const file = { path: "a.md", suppressed: [], allowed, reasonless: [], notRun: [] };
    const en = renderSuppressions([file], "en");
    assert.match(en, /Silenced by allow in chaff\.yaml: 1/u);
    assert.match(en, /allow\[0\] "Kubernetes"/u);
    assert.match(en, /reason: product name/u);
    assert.doesNotMatch(en, /No findings are silenced/u);
    assert.match(renderSuppressions([file], "ja"), /chaff\.yaml の allow で抑制されている指摘: 1 件[\s\S]*理由: product name/u);
  });

  it("says nothing about allow when it silenced nothing", () => {
    assert.doesNotMatch(renderSuppressions([{ path: "a.md", suppressed: [], allowed: [], reasonless: [], notRun: [] }], "en"), /allow/u);
  });
});

describe("allow: on the command line", () => {
  const CONFIG = ["prefer:", "  サーバー: サーバ", "allow:", "  - text: サーバー室", "    reason: 部屋の名前で、表記を変えられない", ""].join("\n");
  const DOC = "# 手順\n\nサーバー室に入る前に、サーバーの電源を確かめます。\n";

  it("drops the allowed finding, keeps the other, and says how many it allowed", async () => {
    const run = await runCli({ "chaff.yaml": CONFIG, "a.md": DOC }, ["a.md"]);
    assert.match(run.out, /allow 1 件/u);
    const compact = await runCli({ "chaff.yaml": CONFIG, "a.md": DOC }, ["a.md", "--compact"]);
    assert.deepEqual(
      compact.out
        .split("\n")
        .filter((line) => line.includes("warning 「サーバー」"))
        .map((line) => line.trim().split(" ")[0]),
      ["3:12"],
    );
    const suppressions = await runCli({ "chaff.yaml": CONFIG, "a.md": DOC }, ["suppressions", "a.md"]);
    assert.match(suppressions.out, /allow\[0\] "サーバー室"[\s\S]*理由: 部屋の名前で、表記を変えられない/u);
  });

  it("stops the run on an entry without a reason", async () => {
    const run = await runCli({ "chaff.yaml": "allow:\n  - text: サーバー室\n", "a.md": DOC }, ["a.md"]);
    assert.notEqual(run.code, 0);
    assert.match(run.err, /allow\[0\]: reason がありません/u);
  });
});
