import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { sweepingSentences } from "../packages/chaff/src/detectors/over-general-claim.ts";
import { tokenizedLexicons } from "../packages/chaff/src/lexicon-tokens.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// over-general-claim: sweeping claims about people (most people, nobody, everyone) piled up in an English document.
// Every sentence here is self-written.

const RULE = "over-general-claim";
/** Plain sentences with no sweeping claim, to give a document a length. Eleven words each. */
const filler = (sentences: number): string => "We shipped the release and reported the numbers to the team. ".repeat(sentences);

const fires = (body: string, genre = "blog/tech"): boolean => firedRules(en, `# Post\n\n${body}`, genre).includes(RULE);

const SWEEPING = "Most people never back up their photos. Nobody thinks about it until a phone breaks. Then everyone wishes they had a copy. ";

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("over-general-claim", () => {
  it("reports a post that piles up most people, nobody and everyone", () => {
    assert.ok(fires(`${SWEEPING}${filler(20)}`));
  });

  it("reports it in business documents too", () => {
    assert.ok(fires(`${SWEEPING}${filler(20)}`, "business/proposal"));
  });

  it("does not report one or two sweeping claims", () => {
    assert.ok(!fires(`Most people never back up their photos. Nobody checks. ${filler(20)}`));
    assert.ok(!fires(`Everyone on the team signed off. ${filler(20)}`));
  });

  it("does not report a document that only repeats everyone (the whole team)", () => {
    const team = "Everyone on the team reviews the plan. Everyone signs off. Everyone gets the notes. Everyone joins the call. ";
    assert.ok(!fires(`${team}${filler(20)}`));
  });

  it("does not report the same uses spread over a long document", () => {
    assert.ok(!fires(`${SWEEPING}${filler(120)}`));
  });

  it("does not measure a short document", () => {
    assert.ok(!fires(SWEEPING));
  });

  it("leaves most people agree and everyone knows to weasel-word, and does not count them", () => {
    const weasel = "Most people agree that backups matter. Everyone knows that phones break. Nobody checks. ";
    const fired = firedRules(en, `# Post\n\n${weasel}${filler(20)}`, "blog/tech");
    assert.ok(!fired.includes(RULE), fired.join(","));
    assert.ok(fired.includes("weasel-word"), fired.join(","));
  });

  it("is off in legal documents", () => {
    assert.ok(!fires(`${SWEEPING}${filler(20)}`, "legal/contract"));
  });

  it("does not run on Japanese documents", () => {
    const fired = firedRules(
      ja,
      `# 記事\n\n${"most people never back up. nobody checks. everyone regrets it. ".repeat(3)}${"本日の連絡です。".repeat(80)}`,
      "blog/tech",
    );
    assert.ok(!fired.includes(RULE));
  });

  it("counts each use in a sentence, and skips a sentence weasel-word reports", () => {
    const doc = buildDocument(
      "t.md",
      "Nobody asked, and nobody cared. Most people agree that nobody reads it. For most of us, it works. Anyone who tried it, and for most households, it saves time.",
      en,
    );
    const found = sweepingSentences(doc, en.lexicons[RULE] ?? []);
    assert.deepEqual(
      found.map((entry) => entry.phrases),
      [["nobody", "nobody"], ["most of us"], ["for most households", "anyone who"]],
    );
  });

  const phrasesOf = (text: string): (readonly string[])[] =>
    sweepingSentences(buildDocument("t.md", text, en), tokenizedLexicons(en.lexicons, en)[RULE] ?? []).map((entry) => entry.phrases);

  it("does not count everyone, anyone who or nobody when a group is named in the same or the previous sentence", () => {
    assert.deepEqual(phrasesOf("The design team met on Monday. Everyone brings one idea to the review."), []);
    assert.deepEqual(phrasesOf("Anyone who is on leave tells the rest of the team first."), []);
    assert.deepEqual(phrasesOf("Our family shares one drive. It keeps a copy for everyone."), []);
    assert.deepEqual(phrasesOf("All of you have the link now. Nobody needs to ask for access."), []);
    assert.deepEqual(phrasesOf("Everyone on the call voted for Friday."), []);
    assert.deepEqual(phrasesOf("Everyone here gets a badge at the door."), []);
  });

  it("does not count them when a past-tense verb reports what one group did", () => {
    assert.deepEqual(phrasesOf("The disk filled up overnight and nobody noticed it."), []);
    assert.deepEqual(phrasesOf("Thanks to everyone who stayed late on Friday."), []);
  });

  it("still counts them when no group is named nearby, or the verb is in the present", () => {
    assert.deepEqual(phrasesOf("Nobody can remember fifty passwords. Everyone reuses a few of them."), [["nobody"], ["everyone"]]);
    assert.deepEqual(phrasesOf("Anyone who has tried it knows the feeling."), [["anyone who"]]);
    assert.deepEqual(phrasesOf("Nobody wants to lose the family photos."), [["nobody"]]);
    assert.deepEqual(phrasesOf("Anyone who asks the office manager gets a key."), [["anyone who"]]);
    assert.deepEqual(phrasesOf("Nobody's reading the manual."), [["nobody"]]);
  });

  it("always counts most people and most of us, even next to a group", () => {
    assert.deepEqual(phrasesOf("Our team tried it. Most people never back up their photos."), [["most people"]]);
    assert.deepEqual(phrasesOf("Compare it to what most of us are doing now."), [["most of us"]]);
  });

  it("counts many people only as the subject of a verb", () => {
    assert.deepEqual(phrasesOf("Yet many people keep every photo on one phone."), [["many people"]]);
    assert.deepEqual(phrasesOf("You may not see many people on the trail."), []);
    assert.deepEqual(phrasesOf("The park was shaped by the many people connected to it."), []);
  });

  it("does not report a team update whose nobody and everyone are the team", () => {
    const update =
      "Hi team, the build server ran out of disk on Monday. Nobody noticed it until the deploy failed. Thanks to everyone who stayed late to fix it. Most people were offline by then. ";
    assert.ok(!fires(`${update}${filler(20)}`, "business/report"));
  });
});
