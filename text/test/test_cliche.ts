import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// Worn phrases (cliche). Every example is self-written.

const RULE = "cliche";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en).findings;

describe("cliche: a worn phrase", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("reports a cliché, whatever its case", () => {
    assert.deepEqual(findingsOf("At the end of the day, the new cache is faster."), ['"at the end of the day" is a cliché']);
    assert.deepEqual(findingsOf("Fixing the login page is low-hanging fruit."), ['"low-hanging fruit" is a cliché']);
    assert.deepEqual(findingsOf("We will touch base next week."), ['"touch base" is a cliché']);
  });

  it("leaves literal uses of the same words alone", () => {
    assert.deepEqual(findingsOf("The meeting ends at the end of the month."), []);
    assert.deepEqual(findingsOf("The fruit on the low branches ripens first."), []);
    assert.deepEqual(findingsOf("Each base station reports its load."), []);
  });

  it("reports more worn phrases, and not the same words used literally", () => {
    assert.deepEqual(findingsOf("Upgrading the cache is a no-brainer."), ['"no-brainer" is a cliché']);
    assert.deepEqual(findingsOf("We should not reinvent the wheel here."), ['"reinvent the wheel" is a cliché']);
    assert.deepEqual(findingsOf("The new normal is remote review."), ['"the new normal" is a cliché']);
    assert.deepEqual(findingsOf("The front wheel was replaced. Normal reviews resume on Monday."), []);
  });

  it("every lexicon phrase is found in a sentence", () => {
    const lexicon = en.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(`They said ${entry.pattern} again.`).length, 1, entry.pattern));
  });

  it("does not read headings", () => {
    assert.deepEqual(findingsOf("# At the end of the day\n\nThe new cache is faster."), []);
  });

  it("does not run on literature", () => {
    const source = "At the end of the day, the new cache is faster.\n";
    assert.ok(firedRules(en, source, "business/report").includes(RULE));
    assert.ok(!firedRules(en, source, "literature/fiction").includes(RULE));
  });
});

const findingsInJapanese = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja).findings;

describe("cliche: 日本語の決まり文句", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("題や書き出しの決まり文句を言う（活用した形も）", () => {
    assert.deepEqual(findingsInJapanese("この記事では、今さら聞けない Git の基本を説明します。"), ["「今さら聞けない」は使い古された決まり文句です"]);
    assert.deepEqual(findingsInJapanese("この記事では React Hooks を徹底解説します。"), ["「徹底解説」は使い古された決まり文句です"]);
    assert.deepEqual(findingsInJapanese("速く書くための極意をお伝えします。"), ["「極意」は使い古された決まり文句です"]);
    assert.deepEqual(findingsInJapanese("知らないと損する控除を紹介します。"), ["「知らないと損する」は使い古された決まり文句です"]);
    assert.deepEqual(findingsInJapanese("知らないと損をした控除です。"), ["「知らないと損」は使い古された決まり文句です"]);
    assert.deepEqual(findingsInJapanese("知らないと損な制度があります。"), ["「知らないと損」は使い古された決まり文句です"]);
  });

  it("同じ字でも別の語なら言わない", () => {
    assert.deepEqual(findingsInJapanese("今さら聞いても遅い。解説を徹底した。徹底的に解説します。"), []);
    assert.deepEqual(findingsInJapanese("仕様を知らないと損失が出ます。手順を知らないと損害が広がります。"), []);
  });

  it("語彙表のどの言い回しも文の中で見つかる", () => {
    const lexicon = ja.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsInJapanese(`これは${entry.pattern}の話です。`).length, 1, entry.pattern));
  });

  it("見出しは読まない", () => {
    assert.deepEqual(findingsInJapanese("# 今さら聞けない Git の基本\n\nコミットの手順を説明します。"), []);
  });
});
