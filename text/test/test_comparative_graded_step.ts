import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// comparative-without-baseline: 段階の一つとしての「より良い」と、「の方が」で相手を立てた比較。例文はすべて自作。

const RULE = "comparative-without-baseline";
const BARE = "「より良い」は、何と比べているかが書かれていません";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("comparative-without-baseline: 段階の一つとしての比較", () => {
  it("文書が一段下の段（良い対応）も書いていれば、より良い対応は段の一つ", () => {
    const source = "# 対応の段階\n\n- より良い（上の段）対応。案内の文だけで用件が分かる。\n- 良い（中の段）対応。前後の文と合わせて用件が分かる。\n";
    assert.deepEqual(findingsOf(source), []);
  });

  it("例の名前（より良い記入例1）も、一段下の例（良い記入例2）があれば段の一つ", () => {
    const source = "# 記入例\n\n申込書は、下のより良い記入例1を見て書く。\n\n良い記入例2も参考になる。\n";
    assert.deepEqual(findingsOf(source), []);
  });

  it("一段下の段を書いていなければ、今までどおり言う", () => {
    assert.deepEqual(findingsOf("# 対応\n\n- より良い対応。案内の文だけで用件が分かる。\n"), [BARE]);
    assert.deepEqual(findingsOf("# 記入例\n\n申込書は、下のより良い記入例1を見て書く。\n"), [BARE]);
  });

  it("名詞の違う「良い」は一段下の段ではない", () => {
    assert.deepEqual(findingsOf("# 対応\n\n- より良い対応。案内の文だけで用件が分かる。\n- 良い天気の日に配る。\n"), [BARE]);
  });
});

describe("comparative-without-baseline: 「の方が」で相手を立てた比較", () => {
  it("「の方が」「のほうが」は二つを比べている", () => {
    assert.deepEqual(findingsOf("# 案内\n\n窓口の方がより良い説明になる。\n"), []);
    assert.deepEqual(findingsOf("# 案内\n\n電話のほうがより早い連絡になる。\n"), []);
  });

  it("「の方が」の無い文は今までどおり言う", () => {
    assert.deepEqual(findingsOf("# 案内\n\n窓口ではより良い説明になる。\n"), [BARE]);
  });
});
