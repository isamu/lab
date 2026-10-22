import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { answeredQuestions } from "../packages/chaff/src/detectors/q-fragment-answer.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// q-fragment-answer: the writer asks a question and answers it at once with a verbless fragment. Every sentence here is
// self-written.

const RULE = "q-fragment-answer";

const fires = (body: string, genre = "blog/tech"): boolean => firedRules(en, `# Post\n\n${body}`, genre).includes(RULE);

const pairs = (text: string): string[] =>
  answeredQuestions(buildDocument("t.md", text, en)).map((found) => `${found.question.text.trim()} | ${found.answer.text.trim()}`);

const TWO = "Is the new setup perfect? No. It still drops a file now and then. The result? Faster builds and fewer late nights.";

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("q-fragment-answer", () => {
  it("reports a post with two questions answered by a fragment, each pair once", () => {
    assert.ok(fires(TWO));
    const findings = firedRules(en, `# Post\n\n${TWO}`, "blog/tech").filter((rule) => rule === RULE);
    assert.equal(findings.length, 2);
  });

  it("does not pair a heading or an answer in another language", () => {
    assert.deepEqual(pairs("## Is it perfect?\n\nNo."), []);
    assert.deepEqual(pairs("Is it perfect? いいえ。"), []);
  });

  it("does not report a single question and answer", () => {
    assert.ok(!fires("Is the new setup perfect? No. It still drops a file now and then."));
  });

  it("runs in blogs and business documents, not in legal ones", () => {
    assert.ok(fires(TWO, "business/report"));
    assert.ok(!fires(TWO, "legal/contract"));
  });

  it("does not run on Japanese documents", () => {
    assert.ok(!firedRules(ja, `# 記事\n\n${TWO}`, "blog/tech").includes(RULE));
  });

  it("finds a fragment answer and a noun question", () => {
    assert.deepEqual(pairs(TWO), ["Is the new setup perfect? | No.", "The result? | Faster builds and fewer late nights."]);
    assert.deepEqual(pairs("How many passwords do you have? Not accounts. Passwords."), ["How many passwords do you have? | Not accounts."]);
  });

  it("does not count an answer with a verb, a long answer, or a question after a question", () => {
    assert.deepEqual(pairs("Feeling stuck? That's normal."), []);
    assert.deepEqual(pairs("Is it ready? It works."), []);
    assert.deepEqual(pairs("Is it ready? Mostly fine."), ["Is it ready? | Mostly fine."]);
    assert.deepEqual(pairs("Is it ready? We shipped it to every user on the list last week."), []);
    assert.deepEqual(pairs("Is it ready? Can we ship it? Not yet."), ["Can we ship it? | Not yet."]);
  });

  it("does not count an aside in brackets or quotes, or an answer in the next paragraph", () => {
    assert.deepEqual(pairs("Read What Is a Comet? (Grades K-4)"), []);
    assert.deepEqual(pairs('Who said it? "Not me."'), []);
    assert.deepEqual(pairs("Who said it? (Not me.)"), []);
    assert.deepEqual(pairs("Is it perfect?\n\nNo."), []);
  });

  it("does not take a noun question that opens without a determiner", () => {
    assert.deepEqual(pairs("Interested in this work? Come and join the team."), []);
  });
});
