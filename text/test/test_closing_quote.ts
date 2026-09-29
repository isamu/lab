import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../packages/lang-en/src/index.ts";
import { closingRunLength, reattachClosingQuotes } from "../packages/lang-en/src/closing-quote.ts";
import { splitAtQuotedStops } from "../packages/lang-en/src/quoted-stop.ts";
import { sentenceSpans } from "../packages/lang-en/src/sentence-split.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";

// sentence-splitter は疑問符・感嘆符の後の曲がった閉じ引用符と直線の一重引用符の手前で文を切る。次の文が「”」で始まる。
// 例文はすべて自作。

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);
const spansOf = (source: string): Span[] => adapter.segment(source).sentences.map((sentence) => sentence.span);

describe("文頭に取り残された閉じ引用符を前の文へ戻す", () => {
  it("疑問符・感嘆符の後の曲がった閉じ引用符（二重・一重・入れ子）と直線の一重引用符。次が大文字なら文は二つのまま", () => {
    assert.deepEqual(textsOf("She asked, “Is it done?” Nobody answered."), ["She asked, “Is it done?”", "Nobody answered."]);
    assert.deepEqual(textsOf("He shouted “Stop!” The car stopped."), ["He shouted “Stop!”", "The car stopped."]);
    assert.deepEqual(textsOf("She asked, ‘Is it done?’ Nobody answered."), ["She asked, ‘Is it done?’", "Nobody answered."]);
    assert.deepEqual(textsOf("He said 'Is it?' Then he left."), ["He said 'Is it?'", "Then he left."]);
    assert.deepEqual(textsOf("He wrote, “She said ‘never?’” Then he left."), ["He wrote, “She said ‘never?’”", "Then he left."]);
    assert.deepEqual(textsOf("He asked «why?» Then he left."), ["He asked «why?»", "Then he left."]);
  });

  it("次の文が開き引用符の後の大文字で始まっても切る。引用だけの文が続いても一つずつ", () => {
    assert.deepEqual(textsOf("Some examples: “How are you?” “How’s it going?” “What’s next?”"), [
      "Some examples: “How are you?”",
      "“How’s it going?”",
      "“What’s next?”",
    ]);
  });

  it("閉じ引用符の後に何も続かなければ、前の文が閉じ引用符まで", () => {
    assert.deepEqual(textsOf("The room was “Will it scale?”"), ["The room was “Will it scale?”"]);
    assert.deepEqual(textsOf("The room was “Will it scale?”  "), ["The room was “Will it scale?”"]);
  });

  it("次が小文字・数字・句読点なら、引用は文の途中なので一つの文につなぐ", () => {
    assert.deepEqual(textsOf("“Is it done?” she asked."), ["“Is it done?” she asked."]);
    assert.deepEqual(textsOf("Click the “Comment Now!” icon, then submit."), ["Click the “Comment Now!” icon, then submit."]);
    assert.deepEqual(textsOf("The room “How do we grade?”, which met twice, closed."), ["The room “How do we grade?”, which met twice, closed."]);
    assert.deepEqual(textsOf("See “Will You Vote?”: File 89 is back."), ["See “Will You Vote?”: File 89 is back."]);
    assert.deepEqual(textsOf("Plan for 'What if?' scenarios early."), ["Plan for 'What if?' scenarios early."]);
    assert.deepEqual(textsOf("He asked “why?”. Then he left."), ["He asked “why?”.", "Then he left."]);
    assert.deepEqual(textsOf("She asked “Which one?” 42 people answered."), ["She asked “Which one?” 42 people answered."]);
  });

  it("つないだ文の後も続けて戻す", () => {
    assert.deepEqual(textsOf("“Stop!” “Why?” he asked. “Go!” Then quiet."), ["“Stop!”", "“Why?” he asked.", "“Go!”", "Then quiet."]);
  });

  it("語頭のアポストロフィ（’Tis ’90s）と開き引用符は動かさない", () => {
    assert.deepEqual(textsOf("It was the ’90s. ’Tis true."), ["It was the ’90s.", "’Tis true."]);
    assert.deepEqual(textsOf("Rock ’n’ roll. Don’t go."), ["Rock ’n’ roll.", "Don’t go."]);
    assert.deepEqual(textsOf("It ended. “Next,” he said."), ["It ended.", "“Next,” he said."]);
    assert.deepEqual(textsOf("It ended. ‘Next,’ he said."), ["It ended.", "‘Next,’ he said."]);
    assert.deepEqual(textsOf("He asked, “Is it done?” ’Tis true."), ["He asked, “Is it done?”", "’Tis true."]);
    assert.deepEqual(textsOf("He asked, “Is it done?” ’90s music played."), ["He asked, “Is it done?” ’90s music played."]);
  });

  it("span は元の文字列の位置のまま。閉じ引用符は前の文の末尾、次の文は空白の後から", () => {
    const source = "Intro. She asked, “Is it done?” Nobody answered.";
    const quote = source.indexOf("”");
    const next = source.indexOf("Nobody");
    assert.deepEqual(spansOf(source), [
      { start: 0, end: 6 },
      { start: 7, end: quote + 1 },
      { start: next, end: source.length },
    ]);
    spansOf(source).forEach((span) => assert.equal(source.slice(span.start, span.end).trim(), source.slice(span.start, span.end)));
  });

  it("閉じ引用符の無い文、句点の外の引用符、直線の二重引用符は今までどおり", () => {
    assert.deepEqual(textsOf("One sentence. Another one."), ["One sentence.", "Another one."]);
    assert.deepEqual(textsOf('She asked, "Is it done?" Nobody answered.'), ['She asked, "Is it done?"', "Nobody answered."]);
    assert.deepEqual(textsOf('"Is it right?" asked the clerk.'), ['"Is it right?" asked the clerk.']);
    assert.deepEqual(textsOf("It was “final.” Then it ended."), ["It was “final.”", "Then it ended."]);
    assert.deepEqual(textsOf("Is it? Yes."), ["Is it?", "Yes."]);
  });
});

describe("closingRunLength", () => {
  it("文頭の閉じ引用符・閉じ括弧の並び。後ろが空白・句読点・終わり", () => {
    assert.equal(closingRunLength("” Then"), 1);
    assert.equal(closingRunLength("’” Then"), 2);
    assert.equal(closingRunLength("”) Then"), 2);
    assert.equal(closingRunLength("' scenarios"), 1);
    assert.equal(closingRunLength('" Then'), 1);
    assert.equal(closingRunLength("”"), 1);
    assert.equal(closingRunLength("”, which"), 1);
    assert.equal(closingRunLength("»: then"), 1);
  });

  it("後ろに字・数字が続けばアポストロフィか開き引用符なので 0。開き引用符・閉じ引用符の無い文も 0", () => {
    assert.equal(closingRunLength("’Tis true."), 0);
    assert.equal(closingRunLength("’90s were loud."), 0);
    assert.equal(closingRunLength("’’Tis"), 0);
    assert.equal(closingRunLength("'Twas"), 0);
    assert.equal(closingRunLength('"Quoted" text'), 0);
    assert.equal(closingRunLength("“Open"), 0);
    assert.equal(closingRunLength("‘ spaced"), 0);
    assert.equal(closingRunLength("Plain."), 0);
    assert.equal(closingRunLength(""), 0);
    assert.equal(closingRunLength(" ” leading space"), 0);
  });
});

describe("reattachClosingQuotes", () => {
  it("空の並びは空、一つの文はそのまま", () => {
    assert.deepEqual(reattachClosingQuotes("", []), []);
    assert.deepEqual(reattachClosingQuotes("” Then.", [{ start: 0, end: 7 }]), [{ start: 0, end: 7 }]);
  });

  it("前の文と間が空いていれば動かさない", () => {
    const text = "Is it? ” Then.";
    const spans = [
      { start: 0, end: 6 },
      { start: 7, end: text.length },
    ];
    assert.deepEqual(reattachClosingQuotes(text, spans), spans);
  });

  it("前の文が句点で終わっていなければ動かさない", () => {
    const text = "A heading” Then.";
    const spans = [
      { start: 0, end: 9 },
      { start: 9, end: text.length },
    ];
    assert.deepEqual(reattachClosingQuotes(text, spans), spans);
  });

  it("戻すときは前の文を閉じ引用符の後まで延ばし、次の文は空白の後から", () => {
    const text = "Is it?”  Then.";
    assert.deepEqual(
      reattachClosingQuotes(text, [
        { start: 0, end: 6 },
        { start: 6, end: text.length },
      ]),
      [
        { start: 0, end: 7 },
        { start: 9, end: text.length },
      ],
    );
  });

  it("渡した並びを書き換えない", () => {
    const text = "Is it?” Then.";
    const spans = [
      { start: 0, end: 6 },
      { start: 6, end: text.length },
    ];
    const copy = structuredClone(spans);
    reattachClosingQuotes(text, spans);
    assert.deepEqual(spans, copy);
  });
});

// 引用符・句点・語・空白を混ぜた入力で、戻した後の性質を確かめる。seed が同じなら同じ入力列になる。
const PIECES = [
  "She asked",
  "“Is it done?”",
  "“Stop!”",
  "‘Why?’",
  "'What if?'",
  "’Tis",
  "’90s",
  "don’t",
  "then",
  "Then",
  "42",
  ",",
  ":",
  ".",
  "?",
  "!",
  "”",
  "’",
  "“",
  "‘",
  "'",
  '"',
  "(",
  ")",
  " ",
  " ",
  "\n",
];
const SEED = 170;
const CASES = 3000;
const MAX_PIECES = 30;

const randomFrom = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value * 1103515245 + 12345) % 2147483648;
    return state.value / 2147483648;
  };
};

const generated = (seed: number, count: number): string[] => {
  const random = randomFrom(seed);
  const piece = (): string => PIECES[Math.floor(random() * PIECES.length)] ?? "";
  return Array.from({ length: count }, () => Array.from({ length: 1 + Math.floor(random() * MAX_PIECES) }, piece).join(""));
};

const coveredCharacters = (text: string, spans: readonly Span[]): string =>
  spans
    .map((span) => text.slice(span.start, span.end))
    .join("")
    .replace(/\s/gu, "");

const assertIntact = (text: string, before: readonly Span[], after: readonly Span[]): void => {
  const label = JSON.stringify(text);
  after.forEach((span, index) => {
    const previous = after[index - 1];
    assert.ok(span.start < span.end && span.end <= text.length, `空でなく、文字列の内側 ${label}`);
    if (previous === undefined) return;
    assert.ok(previous.end <= span.start, `重ならず、順に並ぶ ${label}`);
    const stranded = previous.end === span.start && /[.?!]$/u.test(text.slice(previous.start, previous.end));
    assert.ok(!stranded || closingRunLength(text.slice(span.start, span.end)) === 0, `句点の直後の文が閉じ引用符で始まらない ${label}`);
  });
  assert.equal(coveredCharacters(text, after), coveredCharacters(text, before), `空白以外の字を落とさない ${label}`);
};

describe("生成した入力で、戻した後も文は崩れない", () => {
  it(`重ならず、字を落とさず、句点の直後に閉じ引用符で始まる文が残らない（seed ${String(SEED)}）`, () => {
    const moved = generated(SEED, CASES).filter((text) => {
      const before = sentenceSpans(text).flatMap((span) => splitAtQuotedStops(text, span));
      const after = reattachClosingQuotes(text, before);
      assertIntact(text, before, after);
      return JSON.stringify(after) !== JSON.stringify(before);
    });
    // 戻す場面が生成した入力に含まれていなければ、この性質は何も確かめていない。
    assert.ok(moved.length > 0);
  });
});
