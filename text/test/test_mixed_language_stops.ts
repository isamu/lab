import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { labelStops as jaLabelStops, unmarkLabelStops as jaUnmarkLabelStops } from "../packages/lang-ja/src/label-stop.ts";
import { labelStops as enLabelStops, unmarkLabelStops as enUnmarkLabelStops } from "../packages/lang-en/src/label-stop.ts";
import { splitAtQuotedStops as jaSplitAtQuotedStops } from "../packages/lang-ja/src/quoted-stop.ts";
import { splitAtQuotedStops as enSplitAtQuotedStops } from "../packages/lang-en/src/quoted-stop.ts";
import { closingRunLength as jaClosingRunLength, reattachClosingQuotes as jaReattachClosingQuotes } from "../packages/lang-ja/src/closing-quote.ts";
import { closingRunLength as enClosingRunLength, reattachClosingQuotes as enReattachClosingQuotes } from "../packages/lang-en/src/closing-quote.ts";
import { isEnglishRun } from "../packages/lang-ja/src/english-run.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";

// 和文の中の英文にも、英語のアダプタと同じ切り方を当てる（番号の前の略した名前、閉じ引用符の内側の句点、文頭に残った閉じ引用符）。
// アダプタは互いに依存しないので、日本語のアダプタは英語の関数の写しを持つ。写しが元とずれないことも確かめる。
// US 4,683,202（パブリックドメイン）のほかは自作の文。

const textsOf = (adapter: typeof ja, source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);

const PARITY_SAMPLES = 4000;
const PARITY_LENGTH = 14;
const SEED = 356;

/** 決まった種から同じ並びを出す乱数。落ちたときに同じ入力で再現できる。 */
const randomFrom = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value * 1103515245 + 12345) % 2147483648;
    return state.value / 2147483648;
  };
};

/** 英文の部品を並べた文字列。略した名前・番号・引用符・括弧・文末の記号を混ぜる。 */
const PIECES = [
  "He said",
  "The device",
  "works",
  "FIG.",
  "Fig.",
  "Vol.",
  "No.",
  "U.S.",
  "Dr.",
  "J.",
  "I",
  "1",
  "XLIII",
  "V",
  "e.g.",
  "x.",
  "done.",
  "done?",
  "done!",
  '"',
  "'",
  "“",
  "”",
  "‘",
  "’",
  "(",
  ")",
  "Then",
  "she",
  "left.",
  ",",
  "\n",
];
const englishSamples = (): string[] => {
  const random = randomFrom(SEED);
  return Array.from({ length: PARITY_SAMPLES }, () =>
    Array.from({ length: 1 + Math.floor(random() * PARITY_LENGTH) }, () => PIECES[Math.floor(random() * PIECES.length)] ?? "")
      .map((piece) => (random() < 0.3 ? piece : ` ${piece}`))
      .join("")
      .trim(),
  );
};

describe("和文の中の英文: 番号の前の略した名前の点で切らない", () => {
  it("FIG. 1 と Vol. XLIII は文を切らない", () => {
    assert.deepEqual(textsOf(ja, "FIG. 1 illustrates a sequence. It works."), ["FIG. 1 illustrates a sequence.", "It works."]);
    assert.deepEqual(textsOf(ja, "See Vol. XLIII for details. It is old."), ["See Vol. XLIII for details.", "It is old."]);
    assert.deepEqual(textsOf(ja, "FIGS. 4-1-4-3 illustrate the steps. They run in order."), ["FIGS. 4-1-4-3 illustrate the steps.", "They run in order."]);
  });

  it("和文の後の英文でも同じ", () => {
    assert.deepEqual(textsOf(ja, "図を示す。FIG. 1 illustrates a sequence."), ["図を示す。", "FIG. 1 illustrates a sequence."]);
  });

  it("番号でない語や代名詞の I が続けば、前と同じく切る", () => {
    assert.deepEqual(textsOf(ja, "He said No. I left."), ["He said No.", "I left."]);
    assert.deepEqual(textsOf(ja, "It was the last Fig. The tree fell."), ["It was the last Fig.", "The tree fell."]);
  });

  it("和文の中の FIG. 1 は前と同じく和文の一部", () => {
    assert.deepEqual(textsOf(ja, "構成は FIG. 1 に示す。次に進む。"), ["構成は FIG. 1 に示す。", "次に進む。"]);
  });
});

describe("和文の中の英文: 閉じ引用符の内側の句点で切る", () => {
  it("直線・曲がった引用符の内側の句点の後、次が大文字なら切る", () => {
    assert.deepEqual(textsOf(ja, 'He said "done." Then he left.'), ['He said "done."', "Then he left."]);
    assert.deepEqual(textsOf(ja, "He said “done.” Then he left."), ["He said “done.”", "Then he left."]);
    assert.deepEqual(textsOf(ja, "It was 'done.' Then we left."), ["It was 'done.'", "Then we left."]);
  });

  it("引用符の中が略語か、括弧が開いたままなら切らない", () => {
    assert.deepEqual(textsOf(ja, 'He moved to the "U.S." Then he left.'), ['He moved to the "U.S." Then he left.']);
    assert.deepEqual(textsOf(ja, '(He said "done." Then he left.)'), ['(He said "done." Then he left.)']);
  });

  it("次が小文字なら文の途中", () => {
    assert.deepEqual(textsOf(ja, 'He said "done." and left.'), ['He said "done." and left.']);
  });

  it("仮名を含む断片は英文ではないので、前と同じく切らない", () => {
    assert.deepEqual(textsOf(ja, '彼は "Why?" Then 帰った。'), ['彼は "Why?" Then 帰った。']);
  });
});

describe("和文の中の英文: 文頭に残った閉じ引用符を前の文へ戻す", () => {
  it("疑問符の後の曲がった閉じ引用符。次が大文字なら文は二つ", () => {
    assert.deepEqual(textsOf(ja, "“Is it done?” Nobody knew."), ["“Is it done?”", "Nobody knew."]);
    assert.deepEqual(textsOf(ja, "本文は和文。“Is it done?” Nobody knew."), ["本文は和文。", "“Is it done?”", "Nobody knew."]);
  });

  it("次が小文字や和文なら、引用は文の途中なので一つの文", () => {
    assert.deepEqual(textsOf(ja, "He asked “Why?” and left."), ["He asked “Why?” and left."]);
    assert.deepEqual(textsOf(ja, "“Why?” と聞いた。"), ["“Why?” と聞いた。"]);
  });

  it("閉じ引用符の後に何も無ければ、前の文が閉じ引用符まで", () => {
    assert.deepEqual(textsOf(ja, "The room was “Will it scale?”"), ["The room was “Will it scale?”"]);
  });

  it("文の位置は元の文字列のまま", () => {
    const source = "和文の段落。“Is it done?” Nobody knew. FIG. 1 illustrates it.";
    ja.segment(source).sentences.forEach((sentence) => assert.equal(source.slice(sentence.span.start, sentence.span.end), sentence.text));
  });
});

describe("英文だけの段落は、日本語のアダプタでも英語のアダプタと同じ文に切る（生成した文で比べる）", () => {
  // 字の無い断片（引用符だけ）は英文ではないので、和文と同じく前の断片につなぐ。英語のアダプタとはそこだけ違う。
  const allEnglish = (sample: string): boolean => textsOf(en, sample).every(isEnglishRun);

  it(`seed ${String(SEED)}`, () => {
    const samples = englishSamples().filter(allEnglish);
    assert.ok(samples.length > PARITY_SAMPLES / 2);
    samples.forEach((sample) => assert.deepEqual(textsOf(ja, sample), textsOf(en, sample), `seed ${String(SEED)}: ${JSON.stringify(sample)}`));
  });
});

describe("日本語のアダプタの写しは英語のアダプタの関数と同じ結果を返す（生成した文で比べる）", () => {
  const whole = (text: string): Span => ({ start: 0, end: text.length });
  const labels = ["Vol.", "No.", "Fig.", "Figs.", "Pt.", "Ch."];

  it("unmarkLabelStops", () => {
    const jaStops = jaLabelStops(labels);
    const enStops = enLabelStops(labels);
    englishSamples().forEach((sample) => assert.equal(jaUnmarkLabelStops(sample, jaStops), enUnmarkLabelStops(sample, enStops), JSON.stringify(sample)));
    assert.equal(jaLabelStops([]), enLabelStops([]));
  });

  it("splitAtQuotedStops", () => {
    englishSamples().forEach((sample) =>
      assert.deepEqual(jaSplitAtQuotedStops(sample, whole(sample)), enSplitAtQuotedStops(sample, whole(sample)), JSON.stringify(sample)),
    );
  });

  it("closingRunLength", () => {
    englishSamples().forEach((sample) => assert.equal(jaClosingRunLength(sample), enClosingRunLength(sample), JSON.stringify(sample)));
  });

  it("reattachClosingQuotes", () => {
    englishSamples().forEach((sample) => {
      const spans = en.segment(sample).sentences.map((sentence) => sentence.span);
      const cut = spans.flatMap((span) => [
        { start: span.start, end: Math.floor((span.start + span.end) / 2) },
        { start: Math.floor((span.start + span.end) / 2), end: span.end },
      ]);
      assert.deepEqual(jaReattachClosingQuotes(sample, cut), enReattachClosingQuotes(sample, cut), JSON.stringify(sample));
    });
  });
});
