import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { headingSentences, sentencesWithHeadings } from "../packages/chaff/src/detectors/heading-sentences.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// Headings read as sentences, and ai-tell reading them. Self-written samples.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const SOURCE = "---\ntitle: x\n---\n\n# 工場との橋渡し\n\n本文です。\n\n## 次の一歩\n\n本文。\n\n見出し\n---\n\n本文。\n";

describe("headingSentences", () => {
  it("places each heading's text and words where they stand in the source", () => {
    const sentences = headingSentences(buildDocument("t.md", SOURCE, ja));
    assert.deepEqual(
      sentences.map((sentence) => sentence.text),
      ["工場との橋渡し", "次の一歩", "見出し"],
    );
    sentences.forEach((sentence) => {
      assert.equal(SOURCE.slice(sentence.span.start, sentence.span.end), sentence.text);
      (sentence.tokens ?? []).forEach((token) => assert.equal(SOURCE.slice(token.span.start, token.span.end), token.surface));
    });
  });

  it("gives nothing for a document without headings, or an empty one", () => {
    assert.deepEqual(headingSentences(buildDocument("t.md", "本文だけです。\n", ja)), []);
    assert.deepEqual(headingSentences(buildDocument("t.md", "", ja)), []);
  });

  it("keeps body sentences and headings in source order", () => {
    const starts = sentencesWithHeadings(buildDocument("t.md", SOURCE, ja)).map((sentence) => sentence.span.start);
    assert.deepEqual(
      starts,
      starts.toSorted((left, right) => left - right),
    );
  });
});

const phrasesAtAnyScore = (source: string, adapter: typeof ja) =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report", { "ai-tell": 0 }).findings.filter(
    (finding) => finding.rule === "ai-tell",
  );

describe("ai-tell reads headings", () => {
  it("counts a phrase written in a heading, and points at the heading when it comes first", () => {
    const [finding] = phrasesAtAnyScore("# 工場との橋渡し\n\n本文です。\n", ja);
    assert.equal(String(finding?.values["word"]), "橋渡し");
    assert.equal(finding?.line, 1);
    const [english] = phrasesAtAnyScore("# A game-changer for backups\n\nKeep three copies.\n", en);
    assert.equal(String(english?.values["word"]), "game-changer");
  });

  it("does not count a phrase only quoted in a heading", () => {
    assert.deepEqual(phrasesAtAnyScore('# Why "game-changer" is overused\n\nKeep three copies.\n', en), []);
  });
});
