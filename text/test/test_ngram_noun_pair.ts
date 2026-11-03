import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { hasPredicateIn } from "../packages/chaff/src/detectors/gram-predicate.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// ngram-repetition: a clause modifying nouns joined by a nakaguro (育成すべき資質・能力) is one fixed term of the document, repeated
// because it is what the document is about. The same clause before a single noun stays a phrasing. Self-written text.

const JA_FILLER = Array.from({ length: 70 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");

const worst = (source: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", `${source}\n## 補足\n\n${JA_FILLER}\n`, ja), loadRules(ja.id), {}, true, "business/proposal").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const SUBJECTS = ["小学校", "中学校", "高等学校", "特別支援学校", "幼稚園", "大学", "専門学校", "各学校"];
const TAILS = ["示す。", "整理する。", "明らかにする。", "検討する。", "見直す。", "改める。", "定める。", "考える。"];

const body = (term: string): string => SUBJECTS.map((subject, index) => `${subject}で${term}を${TAILS[index] ?? ""}`).join("");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("ngram-repetition: a clause modifying a nakaguro noun pair", () => {
  it("does not count the clause before a noun pair, and counts it before a single noun", () => {
    assert.equal(worst(`# 諮問\n\n${body("育成すべき資質・能力")}\n`), undefined);
    assert.equal(worst(`# 諮問\n\n${body("育成すべき資質･能力")}\n`), undefined);
    assert.match(worst(`# 諮問\n\n${body("育成すべき能力")}\n`) ?? "", /育成すべき/u);
  });
});

describe("hasPredicateIn: a verb before a nakaguro noun pair", () => {
  const predicateIn = (text: string, phrase: string): boolean => {
    const sentence = buildDocument("t.md", `${text}\n`, ja).sentences[0];
    const start = text.indexOf(phrase);
    assert.ok(sentence?.tokens !== undefined && start >= 0);
    return hasPredicateIn(sentence.tokens, { start: sentence.span.start + start, end: sentence.span.start + start + phrase.length }, "char");
  };

  it("is not a predicate before a noun pair", () => {
    assert.equal(predicateIn("育成すべき資質・能力を示す。", "育成すべき資質・"), false);
    assert.equal(predicateIn("身に付けた知識・技能を使う。", "身に付けた知識・"), false);
  });

  it("is a predicate before a single noun, before a pair joined by other marks, or at the end", () => {
    assert.equal(predicateIn("育成すべき能力を示す。", "育成すべき能力を"), true);
    assert.equal(predicateIn("育成すべき資質、能力を示す。", "育成すべき資質、"), true);
    assert.equal(predicateIn("資質・能力を育成すべきである。", "能力を育成すべき"), true);
  });
});
