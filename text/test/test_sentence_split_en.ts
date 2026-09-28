import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../packages/lang-en/src/index.ts";
import { unmarkNumberStops } from "../packages/lang-en/src/number-stop.ts";

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text.trim());

describe("英語の文分割", () => {
  it("略語・小数・頭字語を文末と誤認しない", () => {
    const source = 'The TTL is short. "Really?" asked Dr. Smith, e.g. in the U.S. market. It costs $3.50 per req. That is the point!';
    assert.deepEqual(textsOf(source), [
      "The TTL is short.",
      '"Really?" asked Dr. Smith, e.g. in the U.S. market.',
      "It costs $3.50 per req.",
      "That is the point!",
    ]);
  });

  it("行の途中の番号の後で、次が大文字なら文を切る", () => {
    assert.deepEqual(textsOf("We opened in the spring of 2026. We shipped in May."), ["We opened in the spring of 2026.", "We shipped in May."]);
    assert.deepEqual(textsOf("See Section 3. The rest follows."), ["See Section 3.", "The rest follows."]);
    assert.deepEqual(textsOf("Install version 2. Then restart."), ["Install version 2.", "Then restart."]);
    assert.deepEqual(textsOf("Read No. 5. It is short."), ["Read No. 5.", "It is short."]);
    assert.deepEqual(textsOf("Sold in the U.S. 2. Next year too."), ["Sold in the U.S. 2.", "Next year too."]);
    assert.deepEqual(textsOf("It closed at 12.\nThe doors stayed shut."), ["It closed at 12.", "The doors stayed shut."]);
  });

  it("番号に見えても、行頭・次が小文字・小数・番号の前の略語では切らない", () => {
    assert.deepEqual(textsOf("1. First item\n2. Second item"), ["1. First item\n2. Second item"]);
    assert.deepEqual(textsOf("  3. Indented item"), ["3. Indented item"]);
    assert.deepEqual(textsOf("It was 2026. and then more."), ["It was 2026. and then more."]);
    assert.deepEqual(textsOf("The ratio is 3.5 Units now."), ["The ratio is 3.5 Units now."]);
    assert.deepEqual(textsOf("Read No. 5 Now."), ["Read No. 5 Now."]);
    assert.deepEqual(textsOf("The year (2026. We) ended."), ["The year (2026. We) ended."]);
  });

  it("番号でない語の文末は今までどおり", () => {
    assert.deepEqual(textsOf("It costs $5. That is cheap."), ["It costs $5.", "That is cheap."]);
    assert.deepEqual(textsOf("Meet at 5 p.m. Bring snacks."), ["Meet at 5 p.m.", "Bring snacks."]);
    assert.deepEqual(textsOf("He came in second. Then he left."), ["He came in second.", "Then he left."]);
  });

  it("オフセットが元文字列と一致する", () => {
    const source = "One sentence. Another one! And a third?";
    adapter.segment(source).sentences.forEach((sentence) => {
      assert.equal(sentence.text, source.slice(sentence.span.start, sentence.span.end));
    });
  });

  it("空文字でも落ちない", () => {
    assert.deepEqual(textsOf(""), []);
  });
});

describe("分割器に渡す前に替える番号", () => {
  it("替えるのは空白で始まる数字だけの語の数字で、長さは変わらない", () => {
    assert.equal(unmarkNumberStops("It was 2026. We moved."), "It was nnnn. We moved.");
    assert.equal(unmarkNumberStops("Code A12. Next is 3.5. Then 7. Done"), "Code A12. Next is 3.5. Then n. Done");
    assert.equal(unmarkNumberStops("1. One\n  22. Two"), "1. One\n  22. Two");
  });
});
