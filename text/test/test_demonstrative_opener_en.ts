import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// demonstrative-opener-run on English: sentences in a row opening with This, That, These, Those or It. Self-written text,
// except the passages that name their public-domain source.

const RULE = "demonstrative-opener-run";

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, level: "strict" | "normal" = "normal"): readonly string[] =>
  namedRuleRun(RULE, source, en, "a.md", "business/report", level).findings;

describe("demonstrative-opener-run: English", () => {
  it("reports three in a row, not two", () => {
    const three = "We introduced a new procedure. This was meant to cut the work. It reduced overtime. That effect should continue next month.\n";
    assert.deepEqual(findingsOf(three), ['3 sentences in a row open with a word that points back, such as "This" (limit 2)']);
    assert.deepEqual(findingsOf("We introduced a new procedure. This was meant to cut the work. It reduced overtime.\n"), []);
  });

  it("restarts the count at a sentence that opens otherwise, and at a new paragraph", () => {
    assert.deepEqual(findingsOf("This is one. It is two. The third is plain. These are four. Those are five.\n"), []);
    assert.deepEqual(findingsOf("This is one. It is two.\n\nThat is three.\n"), []);
  });

  it("matches the word, not the start of a longer one", () => {
    assert.deepEqual(findingsOf("Thistles grew. Items piled up. Thesis drafts waited.\n", "strict"), []);
  });

  it("does not count an opening that names the document, or an it that stands for what follows", () => {
    const self = "This Agreement starts today. This section sets the fees. It applies to every order.\n";
    assert.deepEqual(findingsOf(self), []);
    const ahead = "The cache was rebuilt. It is worth noting that the build took an hour. It seems the disk was slow. This will be checked.\n";
    assert.deepEqual(findingsOf(ahead), []);
    assert.deepEqual(findingsOf("It is obvious that costs rose. It is reasonable to wait. It is helpful to retry.\n"), []);
  });

  it("does not count an opening that names the document as guidance, a handbook or a manual, and still counts one that points back", () => {
    assert.deepEqual(findingsOf("This guidance sets the steps. It covers every team. It lists the forms.\n"), []);
    assert.deepEqual(findingsOf("This handbook is for new staff. It explains the tools. It ends with a checklist.\n"), []);
    assert.deepEqual(findingsOf("The board issued new guidance. This changed the steps. It covers every team. These are the forms.\n"), [
      '3 sentences in a row open with a word that points back, such as "This" (limit 2)',
    ]);
  });

  it("does not count a that which opens a clause", () => {
    assert.deepEqual(findingsOf("That the plan failed is clear. It was costly. This should not recur.\n"), []);
  });

  it("counts a chain of sentences opening with it once, since each it keeps the subject of the one before", () => {
    // The Dartmouth College case (1819), public domain.
    const anaphora =
      "This is plainly a contract to which the donors, the trustees and the crown were the original parties. It is a contract made on a valuable consideration. It is a contract for the security and disposition of property. It is a contract, on the faith of which, real and personal estate has been conveyed to the corporation.\n";
    assert.deepEqual(findingsOf(anaphora), []);
    assert.deepEqual(findingsOf("The new rule took effect. It does not limit production. It does not bind the states. It leaves the quota open.\n"), []);
    assert.deepEqual(findingsOf("We introduced a new procedure. It cut the work. This reduced overtime. That effect should continue.\n"), [
      '3 sentences in a row open with a word that points back, such as "It" (limit 2)',
    ]);
    assert.deepEqual(findingsOf("It cut the work. This reduced overtime. It saved money. That effect should continue.\n"), [
      '4 sentences in a row open with a word that points back, such as "It" (limit 2)',
    ]);
  });

  it("does not count an expletive it that opens a cleft or a hedge", () => {
    // Wickard v. Filburn (1942), public domain.
    const history =
      "It was not until 1887 with the enactment of the Interstate Commerce Act that the interstate commerce power began to exert positive influence. This first important federal resort to the commerce power was followed in 1890 by the Sherman Anti-Trust Act. These statutes ushered in new phases of adjudication.\n";
    assert.deepEqual(findingsOf(history), []);
    assert.deepEqual(findingsOf("It would seem that the plan failed. This was costly. That should not recur.\n"), []);
  });

  it("is off for literature, where repetition is the author's choice, and still runs elsewhere", () => {
    const essay = "The old house stood empty. This was the year the river rose. It took the garden. That loss was never mended.\n";
    assert.equal(firedRules(en, essay, "literature/essay").includes(RULE), false);
    assert.equal(firedRules(en, essay, "legal/judgment").includes(RULE), true);
  });

  it("still reports the Japanese run, which has no English exclusions", () => {
    const three = "新しい手順を導入しました。これは作業を減らすためです。その結果、残業が減りました。この効果は来月も続く見込みです。\n";
    assert.deepEqual(namedRuleRun(RULE, three, ja, "a.md", "business/report", "normal").findings, [
      "「これ」など、指示語で始まる文が 3 文続いています（2 文まで）",
    ]);
  });
});
