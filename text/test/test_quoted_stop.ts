import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../packages/lang-en/src/index.ts";
import { splitAtQuotedStops } from "../packages/lang-en/src/quoted-stop.ts";

// 米国式の引用では、文末のピリオドを閉じ引用符の内側に置く（…"a fair trial." Plainly, …）。
// sentence-splitter は引用符の中の句点で文を切らず、閉じた後の空白でも切らない。次の文が前の文につながる。例文はすべて自作。

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text.trim());

const piecesOf = (sentence: string): string[] =>
  splitAtQuotedStops(sentence, { start: 0, end: sentence.length }).map((span) => sentence.slice(span.start, span.end));

describe("閉じ引用符の内側で閉じた文の後で切る", () => {
  it("ピリオド・疑問符・感嘆符の後の閉じ引用符（直線・曲がり・入れ子の一重）の後、次が大文字なら切る", () => {
    assert.deepEqual(textsOf('The court called it "a fair trial." Plainly, the rule stands.'), [
      'The court called it "a fair trial."',
      "Plainly, the rule stands.",
    ]);
    assert.deepEqual(textsOf("The court called it “a fair trial.” Plainly, the rule stands."), [
      "The court called it “a fair trial.”",
      "Plainly, the rule stands.",
    ]);
    assert.deepEqual(textsOf('She asked, "Is it done?" Nobody answered.'), ['She asked, "Is it done?"', "Nobody answered."]);
    assert.deepEqual(textsOf('He shouted "Stop!" The car stopped.'), ['He shouted "Stop!"', "The car stopped."]);
    assert.deepEqual(textsOf('She asked, "Plan A?" Nobody answered.'), ['She asked, "Plan A?"', "Nobody answered."]);
    assert.deepEqual(textsOf("He wrote, “She said ‘never.’” Then he left."), ["He wrote, “She said ‘never.’”", "Then he left."]);
  });

  it("次の文が開き引用符・括弧の後の大文字で始まっても切る", () => {
    assert.deepEqual(textsOf('It was "final." "We agree," they said.'), ['It was "final."', '"We agree," they said.']);
    assert.deepEqual(textsOf('It was "final." (The appeal failed.)'), ['It was "final."', "(The appeal failed.)"]);
  });

  it("一つの文の中で何度でも切る", () => {
    assert.deepEqual(textsOf('One said "yes." Two said "maybe." Three left.'), ['One said "yes."', 'Two said "maybe."', "Three left."]);
  });

  it("次が小文字・数字・記号なら切らない（文の途中の引用）", () => {
    assert.deepEqual(textsOf('"Is it right?" asked the clerk.'), ['"Is it right?" asked the clerk.']);
    assert.deepEqual(textsOf('The court said "no." 316 U.S. at 462.'), ['The court said "no." 316 U.S. at 462.']);
    assert.deepEqual(textsOf('The term "end." and the term "stop." differ.'), ['The term "end." and the term "stop." differ.']);
  });

  it("閉じ引用符の後に空白が無ければ切らない", () => {
    assert.deepEqual(textsOf('It said "done."Then more.'), ['It said "done."Then more.']);
  });

  it("引用符の中の略語・頭文字のピリオドでは切らない", () => {
    assert.deepEqual(textsOf('He joined the "U.S." Army in May.'), ['He joined the "U.S." Army in May.']);
    assert.deepEqual(textsOf('Ask for "Dr." Smith at the desk.'), ['Ask for "Dr." Smith at the desk.']);
    assert.deepEqual(textsOf('Sign it "J." Then the clerk stamps it.'), ['Sign it "J." Then the clerk stamps it.']);
  });

  it("括弧が開いたままの所では切らない。閉じた後なら切る", () => {
    assert.deepEqual(textsOf('The rule (called "the test." The Court) applies.'), ['The rule (called "the test." The Court) applies.']);
    assert.deepEqual(textsOf('The rule [called "the test." The Court] applies.'), ['The rule [called "the test." The Court] applies.']);
    assert.deepEqual(textsOf('The rule {called "the test." The Court} applies.'), ['The rule {called "the test." The Court} applies.']);
    assert.deepEqual(textsOf('The rule （called "the test." The Court） applies.'), ['The rule （called "the test." The Court） applies.']);
    assert.deepEqual(textsOf('The rule (the test) was "final." The Court agreed.'), ['The rule (the test) was "final."', "The Court agreed."]);
  });

  it("閉じ引用符の無い文と、引用符の外の句点は今までどおり", () => {
    assert.deepEqual(textsOf('It was "final". Then it ended.'), ['It was "final".', "Then it ended."]);
    assert.deepEqual(textsOf("One sentence. Another one."), ["One sentence.", "Another one."]);
  });
});

describe("splitAtQuotedStops", () => {
  it("切れ目の無い文は、渡した span のまま一つ返す", () => {
    assert.deepEqual(splitAtQuotedStops("ab. Cd", { start: 0, end: 6 }), [{ start: 0, end: 6 }]);
    assert.deepEqual(piecesOf(""), [""]);
  });

  it("返す span は元の文字列の位置。前の文は閉じ引用符で終わり、次の文は空白の後から", () => {
    const text = 'Intro. It said "done." Next part.';
    const spans = splitAtQuotedStops(text, { start: 7, end: text.length });
    assert.deepEqual(
      spans.map((span) => text.slice(span.start, span.end)),
      ['It said "done."', "Next part."],
    );
  });

  it("文末の引用符の後に続きが無ければ切らない", () => {
    assert.deepEqual(piecesOf('It said "done."'), ['It said "done."']);
    assert.deepEqual(piecesOf('It said "done."  '), ['It said "done."  ']);
  });
});
