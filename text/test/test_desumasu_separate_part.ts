import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { separatePartSentences, trailingPartSentences } from "../packages/chaff/src/detectors/register-separate-part.ts";
import type { Paragraph, Section, Sentence } from "../packages/chaff/src/plugin.ts";

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

describe("no-mixed-desumasu: 見出しの無い、ページの後ろの注記", () => {
  const note =
    "※PDFファイルが開けない場合はこちらをご覧ください。\n\n第1\n\n第2\n\nなお、この正誤表は本文のみを訂正したもので、取扱いの内容に変更はありません。\n";

  it("多いほうの最後の文より後ろの 2 文が、リンクの行を挟んでみな違う同じ調子なら数えない", () => assert.deepEqual(findingsOf(`${directive}\n${note}`), []));

  it("リンクの行が無いとき、後ろが 1 文だけのとき、後ろで調子が混ざるとき、同じ調子の文が前にもあるときは今までどおり指す", () => {
    assert.equal(findingsOf(`${directive}\nこの通達は、整備を図ったものです。\n\n取扱いの内容に変更はありません。\n`).length, 2);
    assert.equal(findingsOf(`${directive}\n第1\n\n第2\n\n取扱いの内容に変更はありません。\n`).length, 1);
    assert.equal(findingsOf(`${directive}\n${note}\n詳しくは別紙に定める。\n\n窓口は平日に開いています。\n`).length, 2);
    assert.equal(findingsOf(`${directive}\n別紙は窓口で配ります。\n\n経過的取扱いは別に定める。\n\n施行は来月とする。\n\n${note}`).length, 2);
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

describe("trailingPartSentences", () => {
  const sentence = (text: string, start: number): Sentence => ({ text, span: { start, end: start + 1 } });
  const paragraph = (...sentences: Sentence[]): Paragraph => ({
    span: { start: sentences[0]?.span.start ?? 0, end: sentences.at(-1)?.span.end ?? 0 },
    sentences,
  });
  const [a, b, c, link, d] = [sentence("a", 0), sentence("b", 2), sentence("c", 4), sentence("第1", 6), sentence("d", 8)];
  const registers = new Map<Sentence, string>([
    [a, "plain"],
    [b, "plain"],
    [c, "polite"],
    [d, "polite"],
  ]);
  const registerOf = (s: Sentence): string | undefined => registers.get(s);
  const withSentences = (
    paragraphs: Paragraph[],
    registerOfSentence: typeof registerOf,
    majority: string | undefined,
  ): [Sentence[], Paragraph[], typeof registerOf, string | undefined] => [
    paragraphs.flatMap((p) => [...p.sentences]),
    paragraphs,
    registerOfSentence,
    majority,
  ];

  it("the sentences after the last majority one, set off by a line without a register", () =>
    assert.deepEqual(
      [...trailingPartSentences(...withSentences([paragraph(a, b), paragraph(c), paragraph(link), paragraph(d)], registerOf, "plain"))],
      [c, d],
    ));

  it("nothing without the line, with one sentence after, with a mixed tail, with no majority, or with the other register used earlier", () => {
    assert.deepEqual([...trailingPartSentences(...withSentences([paragraph(a, b), paragraph(c), paragraph(d)], registerOf, "plain"))], []);
    assert.deepEqual([...trailingPartSentences(...withSentences([paragraph(a, c), paragraph(link), paragraph(b, d)], registerOf, "plain"))], []);
    assert.deepEqual(
      [...trailingPartSentences(...withSentences([paragraph(a), paragraph(c), paragraph(link), paragraph(b), paragraph(d)], registerOf, "plain"))],
      [],
    );
    assert.deepEqual([...trailingPartSentences(...withSentences([paragraph(c), paragraph(link), paragraph(d)], registerOf, undefined))], []);
    assert.deepEqual([...trailingPartSentences(...withSentences([paragraph(c), paragraph(a, b), paragraph(link), paragraph(d)], registerOf, "plain"))], []);
    assert.deepEqual([...trailingPartSentences(...withSentences([], registerOf, "plain"))], []);
  });
});
