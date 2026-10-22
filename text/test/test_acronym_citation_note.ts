import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { citationNoteSpans } from "../packages/chaff/src/detectors/citation-note.ts";

// undefined-acronym and a note that is a reference: the cited work's title or series carries its own acronyms (IMF
// Economic Review, FRBSF Economic Letter), which the writer does not expand. The notes follow a Federal Reserve speech's
// (public domain); the prose is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const covered = (source: string, word: string): boolean => {
  const at = source.indexOf(word);
  // The sentence starts at its first capital, after a note's mark ([^4]:), as the sentence reader gives it.
  const start = Math.max(0, source.search(/\p{Lu}/u));
  const sentences = [{ text: source.slice(start), span: { start } }];
  return citationNoteSpans(source, sentences, ["and", "&", "et al."]).some((span) => span.start <= at && at + word.length <= span.end);
};

describe("citationNoteSpans", () => {
  it("covers a line that opens with a citation, after a note's number or footnote label", () => {
    assert.equal(covered('See Kevin M. Warsh (2014), "Transparency and the Bank," Review (London: BOE, December).', "BOE"), true);
    assert.equal(covered('Lawrence H. Summers (2015), "Have We Entered an Age?," IMF Economic Review, pp. 277–80.', "IMF"), true);
    assert.equal(covered('[^4]: Barlevy and Hu (2023), "Unit Labor Costs," FRBSF Economic Letter (May).', "FRBSF"), true);
  });

  it("does not cover prose, a citation inside a sentence of prose, or a line without a citation", () => {
    assert.equal(covered("The IMF said in 2015 that growth would slow.", "IMF"), false);
    assert.equal(covered('As the IMF noted, Summers (2015), "Have We Entered an Age?," was early.', "IMF"), false);
    assert.equal(covered('For example, see Summers (2015), "Have We Entered an Age?," on the IMF.', "IMF"), false);
    assert.equal(covered('The IMF (2020), "The Future," Journal Review.', "IMF"), false);
    assert.equal(covered('- See Summers (2015), "Have We Entered an Age?," IMF Economic Review.', "IMF"), false);
    assert.deepEqual(citationNoteSpans("", [], []), []);
  });

  it("covers the sentences after the citation on its line while they are still the reference, not the prose after them", () => {
    const first = 'See Summers (2015), "Have We Entered an Age?"';
    const series = "FRBSF Economic Letter 2023-13 (May 30).";
    const prose = "The SRE remains undefined.";
    const source = `1. ${first} ${series} ${prose}`;
    const sentences = [first, series, prose].map((text) => ({ text, span: { start: source.indexOf(text) } }));
    const spans = citationNoteSpans(source, sentences, []);
    const isCovered = (word: string): boolean => spans.some((span) => span.start <= source.indexOf(word) && source.indexOf(word) < span.end);
    assert.equal(isCovered("FRBSF"), true);
    assert.equal(isCovered("SRE"), false);
  });
});

describe("undefined-acronym: a note that is a reference", () => {
  const speech = (notes: readonly string[]): string =>
    [
      "# Remarks",
      "",
      "Growth has been slow for a decade, and the reasons are still debated.^1",
      "",
      "Prices rose faster than wages last year.^2",
      "",
      ...notes.flatMap((note) => [note, ""]),
    ].join("\n");

  it("the acronyms of a cited title, publisher or series are not reported", () => {
    const notes = [
      '1. See Lawrence H. Summers (2015), "Have We Entered an Age of Secular Stagnation? IMF Fourteenth Annual Research Conference," IMF Economic Review, vol. 63 (1), pp. 277–80. Return to text',
      '2. See Kevin M. Warsh (2014), "Transparency and the Bank of England\'s Monetary Policy Committee," Review commissioned by the Bank of England (London: BOE, December). Return to text',
      '3. See Adam H. Shapiro (2023), "How Much Do Labor Costs Drive Inflation?" FRBSF Economic Letter 2023-13 (Federal Reserve Bank of San Francisco, May 30). Return to text',
    ];
    assert.deepEqual(reportedAcronyms(en, speech(notes)), []);
  });

  it("an acronym in the writer's prose, or in a note that is not a citation, is still reported", () => {
    assert.deepEqual(reportedAcronyms(en, speech(["1. The IMF disagreed at the time."])), ["IMF"]);
    const prose = speech(['1. See Lawrence H. Summers (2015), "Have We Entered an Age?," Review, pp. 277–80.']).replace(
      "Growth has",
      "The IMF says growth has",
    );
    assert.deepEqual(reportedAcronyms(en, prose), ["IMF"]);
  });

  it("PO in a PO Box is not an acronym; PO alone still is", () => {
    assert.deepEqual(reportedAcronyms(en, "# Contact\n\nWrite to PO Box 128, West Glacier.\n"), []);
    assert.deepEqual(reportedAcronyms(en, "# Orders\n\nSend the PO to the buyer.\n"), ["PO"]);
  });
});
