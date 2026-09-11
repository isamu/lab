import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySuppressions, parseSuppressions } from "../packages/chaff/src/stet.ts";
import { fingerprint, prune, readBaseline, splitByBaseline, writeBaseline } from "../packages/chaff/src/baseline.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

const finding = (rule: string, line: number, quote = "本文"): Finding => ({ rule, severity: "warning", line, column: 1, quote, values: {} });

describe("stet の読み取り", () => {
  it("ルール名と理由を取り出す", () => {
    const found = parseSuppressions("<!-- stet: bold-density — 用語集なので意図的 -->");
    assert.deepEqual(found[0]?.rules, ["bold-density"]);
    assert.equal(found[0]?.reason, "用語集なので意図的");
    assert.equal(found[0]?.scope, "next");
  });

  it("複数のルールをまとめて指定できる", () => {
    assert.deepEqual(parseSuppressions("<!-- stet-file: ai-tell, rule-of-three -->")[0]?.rules, ["ai-tell", "rule-of-three"]);
  });

  it("理由が無くても読めるが、理由なしとして数える", () => {
    const found = parseSuppressions("<!-- stet: bold-density -->");
    assert.equal(found[0]?.reason, undefined);
  });

  it("stet でないコメントは拾わない", () => {
    // 誤検知しやすい正常な文章。ふつうの HTML コメントを抑制と読まない。
    assert.deepEqual(parseSuppressions("<!-- ここは後で書く -->"), []);
    assert.deepEqual(parseSuppressions("<!-- TODO: bold-density を見直す -->"), []);
  });
});

describe("stet の適用", () => {
  const sections = [{ start: 0, end: 200 }];

  it("指定したルールだけを黙らせる", () => {
    const source = "<!-- stet: bold-density — 意図的 -->\n本文です。";
    const applied = applySuppressions(source, [finding("bold-density", 2), finding("heading-echo", 2)], sections);
    assert.deepEqual(
      applied.kept.map((entry) => entry.rule),
      ["heading-echo"],
    );
    assert.equal(applied.suppressed.length, 1);
  });

  it("stet-file は文書のどこでも効く", () => {
    const applied = applySuppressions("<!-- stet-file: bold-density -->\n本文。", [finding("bold-density", 99)], sections);
    assert.equal(applied.kept.length, 0);
  });

  it("stet は前の行の指摘には効かない", () => {
    // 抑制は「この先の箇所」に対して書く。遡って効くと、意図せず黙る範囲が広がる。
    const source = "本文。\n\n\n\n\n<!-- stet: bold-density — 意図的 -->\n本文。";
    assert.equal(applySuppressions(source, [finding("bold-density", 1)], sections).kept.length, 1);
  });

  it("理由の無い抑制を数える", () => {
    const applied = applySuppressions("<!-- stet-file: bold-density -->", [], sections);
    assert.equal(applied.unusedReasonless.length, 1);
  });

  it("抑制が無ければ何も落とさない", () => {
    const applied = applySuppressions("ただの本文です。", [finding("bold-density", 1)], sections);
    assert.equal(applied.kept.length, 1);
  });
});

describe("baseline", () => {
  const tmpFile = (): string => join(mkdtempSync(join(tmpdir(), "chaff-")), ".chaff-baseline.json");

  it("棚上げしたものは報告しない", () => {
    const one = finding("bold-density", 5, "ここが問題の文");
    const split = splitByBaseline("a.md", [one], { version: 1, created: "2026-09-11", entries: [fingerprint("a.md", one)] });
    assert.equal(split.fresh.length, 0);
    assert.equal(split.shelved, 1);
  });

  it("新しく増えたものは報告する", () => {
    const old = finding("bold-density", 5, "古い文");
    const fresh = finding("bold-density", 9, "新しい文");
    const split = splitByBaseline("a.md", [old, fresh], { version: 1, created: "2026-09-11", entries: [fingerprint("a.md", old)] });
    assert.deepEqual(
      split.fresh.map((entry) => entry.quote),
      ["新しい文"],
    );
  });

  it("行番号が動いても同じ指摘とみなす", () => {
    // 前に段落を 1 つ足しただけで棚上げが全部剥がれると、baseline は使い物にならない。
    const before = finding("bold-density", 5, "ここが問題の文");
    const after = finding("bold-density", 40, "ここが問題の文");
    assert.equal(fingerprint("a.md", before), fingerprint("a.md", after));
  });

  it("空白の違いでは別物にしない", () => {
    assert.equal(fingerprint("a.md", finding("x", 1, "a  b\n c")), fingerprint("a.md", finding("x", 1, "a b c")));
  });

  it("ファイルが違えば別物とみなす", () => {
    assert.notEqual(fingerprint("a.md", finding("x", 1)), fingerprint("b.md", finding("x", 1)));
  });

  it("baseline が無ければ全部を報告する", () => {
    assert.equal(splitByBaseline("a.md", [finding("x", 1)], undefined).fresh.length, 1);
  });

  it("書き出して読み戻せる", () => {
    const path = tmpFile();
    writeBaseline(path, ["bbb", "aaa"]);
    assert.deepEqual(readBaseline(path)?.entries, ["aaa", "bbb"]);
  });

  it("壊れたファイルは無いものとして扱う", () => {
    const path = tmpFile();
    writeBaseline(path, ["aaa"]);
    assert.ok(readBaseline(path) !== undefined);
    assert.equal(readBaseline(join(mkdtempSync(join(tmpdir(), "chaff-")), "nope.json")), undefined);
  });

  it("直った分だけを落とし、増える方向には動かさない", () => {
    const previous = { version: 1 as const, created: "2026-09-11", entries: ["a", "b", "c"] };
    assert.deepEqual(prune(previous, ["a", "c", "z"]), ["a", "c"]);
  });
});
