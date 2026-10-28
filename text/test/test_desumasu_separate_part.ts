import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { separatePartSentences } from "../packages/chaff/src/detectors/register-separate-part.ts";
import type { Section, Sentence } from "../packages/chaff/src/plugin.ts";

// no-mixed-desumasu: 一番上の見出しで分けた二つの文書（通達と、それを載せたページの説明）は、それぞれの調子で書く。
// 例文は国税庁の法令解釈通達のページを縮めたものと自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", "business/email").findings;

const directive = [
  "# 法人税基本通達等の一部改正について",
  "",
  "法令解釈通達の一部を別紙のとおり改正したから、これによられたい。",
  "",
  "なお、経過的取扱いは、別紙の第9による。",
  "",
  "おって、改正箇所のみを掲げることとした。",
  "",
].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("no-mixed-desumasu: 一番上の見出しで分けた別の文書", () => {
  it("二つ目の部分の 2 文がみな、文書の多いほうと違う同じ調子なら数えない", () => {
    const page =
      "# 「法人税基本通達等の一部改正について」\n\nこの通達は、法令の改正に対応して整備を図ったものです。\n\n主要な改正項目は別のファイルにまとめています。\n";
    assert.deepEqual(findingsOf(`${directive}\n${page}`), []);
  });

  it("部分の文が 1 文だけのとき、部分の中で調子が混ざるとき、見出しが一つだけのときは今までどおり指す", () => {
    assert.equal(findingsOf(`${directive}\n# 説明\n\nこの通達は、法令の改正に対応して整備を図ったものです。\n`).length, 1);
    assert.equal(
      findingsOf(`${directive}\n# 説明\n\nこの通達は、整備を図ったものです。\n\n主要な改正項目は別のファイルにまとめた。\n\n詳しくは窓口にお尋ねください。\n`)
        .length,
      2,
    );
    assert.equal(findingsOf(`${directive}\n## 説明\n\nこの通達は、整備を図ったものです。\n\n主要な改正項目は別のファイルにまとめています。\n`).length, 2);
  });
});

describe("separatePartSentences", () => {
  const sentence = (text: string): Sentence => ({ text, span: { start: 0, end: 0 } });
  const section = (depth: number, sentences: Sentence[]): Section => ({
    depth,
    heading: "",
    span: { start: 0, end: 0 },
    sentences,
    strongCount: 0,
    firstSentence: sentences[0],
  });
  const a = sentence("a");
  const b = sentence("b");
  const c = sentence("c");
  const d = sentence("d");
  const e = sentence("e");
  const registers = new Map<Sentence, string>([
    [a, "plain"],
    [b, "plain"],
    [c, "polite"],
    [d, "polite"],
  ]);
  const registerOf = (s: Sentence): string | undefined => registers.get(s);

  it("a part of two sentences or more, all in one register other than the majority", () => {
    assert.deepEqual([...separatePartSentences([section(1, [a, b]), section(1, [c]), section(2, [d, e])], registerOf, "plain")], [c, d, e]);
  });

  it("nothing for one part, a part in the majority, a part of one sentence, or no sections", () => {
    assert.deepEqual([...separatePartSentences([section(1, [a, b, c, d])], registerOf, "plain")], []);
    assert.deepEqual([...separatePartSentences([section(1, [c]), section(1, [a, b])], registerOf, "plain")], []);
    assert.deepEqual([...separatePartSentences([section(1, [a]), section(1, [c, e])], registerOf, "plain")], []);
    assert.deepEqual([...separatePartSentences([section(0, [c, d]), section(2, [a, b])], registerOf, "plain")], []);
    assert.deepEqual([...separatePartSentences([], registerOf, undefined)], []);
  });
});
