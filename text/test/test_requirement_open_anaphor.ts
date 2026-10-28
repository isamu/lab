import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LexiconEntry, Token } from "../packages/chaff/src/plugin.ts";
import { anaphorWordsOf, isAnaphorCue, refersBack } from "../packages/chaff/src/detectors/open-end-anaphor.ts";

// requirement-smell: a list a pointing word opens (当該改良、改善等) names one given before. Self-written tokens only.

const token = (surface: string, pos: string): Token => ({ surface, pos, span: { start: 0, end: 0 } });
const at = (surfaces: readonly (readonly [string, string])[]): Token[] => surfaces.map(([surface, pos]) => token(surface, pos));
const entry = (pattern: string, group: string): LexiconEntry => ({ pattern, group, tokens: [token(pattern, "NOUN")] });

const words = anaphorWordsOf([entry("等", ""), entry("当該", "list-anaphor")]);
/** The open word at the token before the last. */
const openAt = (tokens: readonly Token[]): { start: number; end: number } => ({ start: tokens.length - 2, end: tokens.length - 1 });

describe("refersBack", () => {
  it("reads the pointing words by group", () => {
    assert.deepEqual(
      words.map((word) => word.pattern),
      ["当該"],
    );
    assert.equal(isAnaphorCue(entry("当該", "list-anaphor")), true);
    assert.equal(isAnaphorCue(entry("等", "")), false);
  });

  it("a list whose first word points back, across the marks between its items", () => {
    const tokens = at([
      ["甲", "NOUN"],
      ["は", "ADP"],
      ["、", "PUNCT"],
      ["当該", "NOUN"],
      ["写真", "NOUN"],
      ["、", "PUNCT"],
      ["動画", "NOUN"],
      ["等", "NOUN"],
      ["を", "ADP"],
    ]);
    assert.equal(refersBack(tokens, { start: 7, end: 8 }, words), true);
  });

  it("a pointing word inside the list, not at its head, or none at all", () => {
    const inside = at([
      ["写真", "NOUN"],
      ["、", "PUNCT"],
      ["当該", "NOUN"],
      ["動画", "NOUN"],
      ["等", "NOUN"],
      ["を", "ADP"],
    ]);
    const none = at([
      ["写真", "NOUN"],
      ["等", "NOUN"],
      ["を", "ADP"],
    ]);
    assert.equal(refersBack(inside, openAt(inside), words), false);
    assert.equal(refersBack(none, openAt(none), words), false);
  });

  it("an open word at the start of the sentence, an empty sentence, or no pointing words", () => {
    const bare = at([
      ["等", "NOUN"],
      ["を", "ADP"],
    ]);
    assert.equal(refersBack(bare, { start: 0, end: 1 }, words), false);
    assert.equal(refersBack([], { start: 0, end: 1 }, words), false);
    assert.equal(
      refersBack(
        at([
          ["当該", "NOUN"],
          ["写真", "NOUN"],
          ["等", "NOUN"],
        ]),
        { start: 2, end: 3 },
        [],
      ),
      false,
    );
  });
});
