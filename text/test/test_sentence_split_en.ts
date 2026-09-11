import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../packages/lang-en/src/index.ts";

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
