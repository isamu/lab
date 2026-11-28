import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// A comparison whose baseline the sentence gives without a baseline word: a cause, a contrast, a change from now, two
// kinds of one thing, a maxim. The examples are all self-written.

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun("comparative-without-baseline", `${source}\n`, adapter).findings;

describe("comparative-without-baseline: a baseline the sentence gives without a baseline word", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("a contrast inside the sentence (…, but) sets the clause before it as the baseline", () => {
    assert.deepEqual(findingsOf("Log lines work, but a real profiler is better, and we use one."), []);
  });

  it("a sentence-initial But has no clause before it in the sentence, and is still reported", () => {
    assert.deepEqual(findingsOf("We shipped it. But the new profiler is better."), ['"better" does not say what it is compared with']);
  });

  it("a sentence opening on a change or a topic (As …, By …) compares with the state before it", () => {
    assert.deepEqual(findingsOf("As the service splits into parts, the whole team can move faster."), []);
    assert.deepEqual(findingsOf("By caching the index, lookups become faster."), []);
    assert.deepEqual(findingsOf("As to the second clause, the question is more fundamental."), []);
  });

  it("as inside the sentence (such as) is not an opener", () => {
    assert.deepEqual(findingsOf("Tools such as this one are faster."), ['"faster" does not say what it is compared with']);
  });

  it("make or do shortly before the comparative is a change from the present state", () => {
    assert.deepEqual(findingsOf("The checks run on every commit to make releases more predictable."), []);
    assert.deepEqual(findingsOf("This draft is not ideal. We can definitely do better."), []);
  });

  it("make in another clause does not make the comparison a change", () => {
    assert.deepEqual(findingsOf("We make tools, and the new engine is faster."), ['"faster" does not say what it is compared with']);
  });

  it("a negated condition word (couldn't) is the condition word", () => {
    assert.deepEqual(findingsOf("Our two offices couldn't be more different."), []);
    assert.deepEqual(findingsOf("Our two offices couldn’t be more different."), []);
  });

  it("a maxim weighing two comparatives (simpler is better) names its own baseline", () => {
    assert.deepEqual(findingsOf("When naming files, simpler is better."), []);
    assert.deepEqual(findingsOf("Simple code is better."), ['"better" does not say what it is compared with']);
  });

  it("the same noun under a different modifier in the sentence before is the other kind compared with", () => {
    assert.deepEqual(findingsOf("Plain backgrounds are fine. A blurred background usually looks better."), []);
  });

  it("another noun, or the same noun without a modifier before, is not another kind, and is still reported", () => {
    assert.deepEqual(findingsOf("Plain walls are fine. A blurred background usually looks better."), ['"better" does not say what it is compared with']);
    assert.deepEqual(findingsOf("We rewrote the parser. The new parser is faster."), ['"faster" does not say what it is compared with']);
  });

  it("a baseline of several words (that follows) names what comes before", () => {
    assert.deepEqual(findingsOf("The trail that follows is much more difficult."), []);
    assert.deepEqual(findingsOf("The trail is much more difficult."), ['"more difficult" does not say what it is compared with']);
  });

  it("日本語: 比べた語より前の原因（これにより、ことにより、…ため、）は、原因の無いときと比べている", () => {
    assert.deepEqual(findingsOf("書式を一つにしました。これにより、申請がより簡単になりました。", ja), []);
    assert.deepEqual(findingsOf("記録を残すことにより、点検がより確実になる。", ja), []);
    assert.deepEqual(findingsOf("全員の状況を画面で見られるため、指導がより丁寧になります。", ja), []);
  });

  it("日本語: 原因の無い変化と、比べた語より後ろの理由は、これまでどおり言う", () => {
    assert.deepEqual(findingsOf("新しい版で、申請がより簡単になりました。", ja), ["「より簡単」は、何と比べているかが書かれていません"]);
    assert.deepEqual(findingsOf("申請がより簡単になったため、窓口が空いた。", ja), ["「より簡単」は、何と比べているかが書かれていません"]);
  });

  it("日本語: 「場合」の下の比較は、その場合でないときと比べている", () => {
    assert.deepEqual(findingsOf("負担の大きい作業がある場合は、より軽い作業に替えてください。", ja), []);
    assert.deepEqual(findingsOf("作業を、より軽い作業に替えてください。", ja), ["「より軽い」は、何と比べているかが書かれていません"]);
  });

  it("日本語: 名詞の並びに「の実現」が続く比較は、今より良くする目当て", () => {
    assert.deepEqual(findingsOf("研修では、より良い多文化共生の実現に向けて話し合います。", ja), []);
    assert.deepEqual(findingsOf("研修では、より良い多文化共生の報告を届けます。", ja), ["「より良い」は、何と比べているかが書かれていません"]);
  });
});
