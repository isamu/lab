import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inChecklistOrder } from "../packages/chaff/src/compare/facts-render.ts";
import type { Atom } from "../packages/chaff/src/compare/atom.ts";
import { runCli } from "./cli-run.ts";

// chaff facts: the inventory a full rewrite starts from, read by compare's own extractor. Every text here is written for the test.

const lines = (...rows: string[]): string => rows.join("\n");

const JA = lines(
  "# 料金の改定について",
  "",
  "2026年4月1日から、月額料金を1,000円から1,200円に改定します。詳しくは https://example.com/price をご覧ください。",
  "",
  "## 対象",
  "",
  "対象は約３万人の契約者です。受付は午後3時30分までです。設定は `plan: basic` のままです。",
);

const EN = lines(
  "# Pricing update",
  "",
  "From April 1, 2026, the monthly fee rises from $10 to $12.50. Section 4.2 has the details: https://example.com/price.",
  "",
  'Questions go to Acme Corp. in Boston before 5 p.m. The "Basic" plan keeps the `basic` key.[^1]',
  "",
  "[^1]: The key stays the same.",
);

type JsonFact = { readonly kind: string; readonly key: string; readonly text: string; readonly line: number };
type FactsJson = {
  readonly path: string;
  readonly language: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly unread: readonly { readonly kind: string; readonly reason: string }[];
  readonly facts: readonly JsonFact[];
};
type CompareJson = { readonly before: { readonly counts: Readonly<Record<string, number>> } };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isFactsJson = (value: unknown): value is FactsJson => isRecord(value) && Array.isArray(value["facts"]) && isRecord(value["counts"]);
const isCompareJson = (value: unknown): value is CompareJson => isRecord(value) && isRecord(value["before"]);

const factsJson = (out: string): FactsJson => {
  const parsed: unknown = JSON.parse(out);
  assert.ok(isFactsJson(parsed), out);
  return parsed;
};

const atom = (kind: Atom["kind"], line: number, text = `${kind}${String(line)}`): Atom => ({ kind, key: text, text, line });

describe("the order of the checklist", () => {
  it("goes kind by kind in compare's order, then by line", () => {
    const ordered = inChecklistOrder([atom("heading", 1), atom("url", 3), atom("number", 5), atom("number", 2), atom("date", 4)]);
    assert.deepEqual(
      ordered.map((each) => `${each.kind}:${String(each.line)}`),
      ["number:2", "number:5", "date:4", "url:3", "heading:1"],
    );
  });

  it("keeps a fact stated twice twice, since compare counts it twice", () => {
    assert.equal(inChecklistOrder([atom("number", 3, "5件"), atom("number", 3, "5件")]).length, 2);
  });

  it("leaves an empty list empty", () => {
    assert.deepEqual(inChecklistOrder([]), []);
  });
});

describe("chaff facts on the command line", () => {
  it("lists every fact as a checklist with its line, every kind counted, zeros too", async () => {
    const run = await runCli({ "a.md": EN }, ["facts", "a.md"], "ja_JP.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(
      run.out,
      /^a\.md: \d+ facts \(numbers \d+, dates 1, times 1, URLs 1, code 1, names \d+, quotations 1, headings 1, references 1, footnotes 2\)/u,
    );
    assert.match(run.out, /\nURLs: 1\n {2}- \[ \] https:\/\/example\.com\/price {2}\(a\.md:3\)/u);
    assert.match(run.out, /\nfootnotes: 2\n {2}- \[ \] \[\^1\] {2}\(a\.md:5\)\n {2}- \[ \] \[\^1\]: {2}\(a\.md:7\)/u);
    assert.match(run.out, /\ncode: 1\n {2}- \[ \] basic {2}\(a\.md:5\)/u);
    assert.match(run.out, /npx chaffjs compare a\.md <rewritten>/u);
  });

  it("shows no heading for a kind the document does not state, nor for a document read in full", async () => {
    const run = await runCli({ "a.md": lines("# Notes", "", "We met on Tuesday.") }, ["facts", "a.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.doesNotMatch(run.out, /\nURLs: /u);
    assert.match(run.out, /URLs 0/u);
    assert.doesNotMatch(run.out, /Not fully read/u);
  });

  it("speaks the document's language, not the terminal's", async () => {
    const run = await runCli({ "a.md": JA }, ["facts", "a.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /^a\.md の事実 \d+ 件（数 \d+、日付 1、時刻 1、URL 1、コード 1、/u);
    assert.match(run.out, /\n数 \d+ 件\n {2}- \[ \] /u);
    assert.match(run.out, /- \[ \] 1,200円 {2}\(a\.md:3\)/u);
    assert.match(run.out, /書き直したら npx chaffjs compare a\.md <書き直した後>/u);
  });

  it("says which kinds it could not read, and why", async () => {
    const run = await runCli({ "a.txt": "The fee is $10 from 2026-04-01." }, ["facts", "a.txt"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /\nNot fully read\n {2}code: the document is not Markdown/u);
    const compact = await runCli({ "a.txt": "The fee is $10 from 2026-04-01." }, ["facts", "a.txt", "--compact"], "en_US.UTF-8");
    assert.match(compact.out, /^a\.txt: unread code \(plain-text\)$/mu);
  });

  it("--compact gives one fact per line with the kind in English, then the counts", async () => {
    const run = await runCli({ "a.md": JA }, ["facts", "a.md", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    const rows = run.out.split("\n");
    assert.match(rows[0] ?? "", /^a\.md:3: number /u);
    assert.ok(rows.includes("a.md:3: url https://example.com/price"), run.out);
    assert.match(rows.at(-1) ?? "", /^a\.md の事実 \d+ 件/u);
    assert.doesNotMatch(run.out, /- \[ \]/u);
  });

  it("--json holds every fact with kind, key, text and line, and wins over --compact", async () => {
    const run = await runCli({ "a.md": EN }, ["facts", "a.md", "--json", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    const parsed = factsJson(run.out);
    assert.equal(parsed.path, "a.md");
    assert.equal(parsed.language, "en");
    assert.deepEqual(parsed.unread, []);
    assert.equal(
      parsed.facts.length,
      Object.values(parsed.counts).reduce((sum, count) => sum + count, 0),
    );
    assert.ok(parsed.facts.some((fact) => fact.kind === "url" && fact.text === "https://example.com/price" && fact.line === 3));
    assert.ok(parsed.facts.some((fact) => fact.kind === "footnote"));
  });

  it("lists exactly what compare counts in the same document", async () => {
    const documents: readonly (readonly [string, string])[] = [
      ["a.md", EN],
      ["b.md", JA],
      ["c.txt", "The fee is $10 from 2026-04-01."],
    ];
    // One at a time: runCli changes the working directory and console for the whole process.
    for (const [name, body] of documents) {
      const facts = factsJson((await runCli({ [name]: body }, ["facts", name, "--json"], "en_US.UTF-8")).out);
      const compared: unknown = JSON.parse((await runCli({ [name]: body }, ["compare", name, name, "--json"], "en_US.UTF-8")).out);
      assert.ok(isCompareJson(compared));
      assert.deepEqual(facts.counts, compared.before.counts, name);
    }
  });

  it("reads the value of --language and --genre as a value, not a file", async () => {
    const run = await runCli({ "a.md": JA }, ["facts", "--language", "ja", "--genre", "blog/tech", "a.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /^a\.md の事実/u);
  });

  it("--language decides how the document is read", async () => {
    const run = await runCli({ "a.md": EN }, ["facts", "a.md", "--language", "ja", "--json"], "en_US.UTF-8");
    assert.equal(factsJson(run.out).language, "ja");
  });

  it("takes one file: none or two is a usage error, in the host's language", async () => {
    const none = await runCli({}, ["facts"], "en_US.UTF-8");
    assert.equal(none.code, 1);
    assert.match(none.err, /^usage: chaff facts <file>/u);
    const two = await runCli({ "a.md": EN, "b.md": EN }, ["facts", "a.md", "b.md"], "ja_JP.UTF-8");
    assert.equal(two.code, 1);
    assert.match(two.err, /^使い方: chaff facts <file>/u);
    assert.equal(two.out, "");
  });

  it("ends with 1 when the file cannot be read", async () => {
    const run = await runCli({}, ["facts", "missing.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /missing\.md/u);
  });
});
