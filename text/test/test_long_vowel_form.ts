import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { markDroppedLongVowels, remembered } from "../packages/lang-ja/src/long-vowel-form.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// lang-ja asks the dictionary about katakana words only once a rule reads LongVowelEnding. Its own file, so no other
// test has asked first in this process.

const isDropped = (token: Token): boolean => token.features?.["LongVowelEnding"] === "Dropped";

const marked = (): boolean =>
  buildDocument("t.md", "# 報告\n\nメモリを使います。\n", ja)
    .sentences.flatMap((sentence) => sentence.tokens ?? [])
    .some(isDropped);

const noun = (surface: string, pos = "NOUN"): Token => ({ span: { start: 0, end: surface.length }, surface, pos });

describe("LongVowelEnding", () => {
  it("is not marked until a prepare asks for it, and stays marked after", async () => {
    await ja.prepare?.({ pos: true });
    assert.equal(marked(), false);
    await ja.prepare?.({ pos: true, features: ["LongVowelEnding"] });
    assert.equal(marked(), true);
    await ja.prepare?.({ pos: true });
    assert.equal(marked(), true);
  });

  it("markDroppedLongVowels marks only katakana nouns of two or more kana without a final ー", () => {
    const knows = (): boolean => true;
    const marks = markDroppedLongVowels([noun("メモリ"), noun("メモリー"), noun("メ"), noun("めもり"), noun("メモリ", "PROPN")], knows).map(isDropped);
    assert.deepEqual(marks, [true, false, false, false, false]);
    assert.deepEqual(markDroppedLongVowels([noun("メモリ")], () => false).map(isDropped), [false]);
  });

  it("remembered asks once per word", () => {
    const asked: string[] = [];
    const ask = remembered((surface) => {
      asked.push(surface);
      return surface === "メモリ";
    });
    assert.deepEqual([ask("メモリ"), ask("メモリ"), ask("データ")], [true, true, false]);
    assert.deepEqual(asked, ["メモリ", "データ"]);
  });

  it("chaff eval --rule measures the rule with its tags and options even when lint would not run it", async () => {
    const run = await runCli(
      {
        "chaff.yaml": "language: ja\noptions:\n  katakana-long-vowel:\n    ending: keep\n",
        "a.md": "# 報告\n\nメモリを使います。メモリは足ります。\n",
      },
      ["eval", "a.md", "--rule", "katakana-long-vowel"],
    );
    assert.equal(run.code, 0);
    assert.match(run.out, /1 {5}1 文書 \(100\.0%\) {3}指摘 {3}2 件/u);
  });
});
