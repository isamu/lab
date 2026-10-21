import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { citationMarks, type CitationWords } from "../packages/chaff/src/detectors/citation-marks.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// citation-reference-mismatch on names longer than one word: a surname with a particle (Santoni de Sio, Van de Poel),
// an organisation (Council of the European Union), a page list after the year, and an interval in brackets. Every
// example is self-written.

const slipsOf = (source: string): string[][] =>
  runRules(buildDocument("t.md", source, en), loadRules(en.id), {}, false, "academic/paper")
    .findings.filter((finding) => finding.rule === "citation-reference-mismatch")
    .map((finding) => [finding.variant ?? "", String(finding.values["key"])]);

const list = (...entries: string[]): string => ["", "## References", "", ...entries.map((entry) => `- ${entry}`), ""].join("\n");

const WORDS: CitationWords = {
  pairs: ["and", "&"],
  others: ["et al."],
  notAuthors: new Set(["march"]),
  referenceHeadings: ["References"],
  connectors: ["de", "van", "den", "of", "the"],
  particles: ["de", "van", "den"],
};

const keysIn = (text: string): string[][] =>
  citationMarks(text, [], WORDS).map((mark) => mark.authorYears.map((cited) => `${cited.author}${cited.severalWords === true ? "?" : ""}`));

describe("citation-reference-mismatch: a name of several words", () => {
  const entries = list(
    "Mecacci and Santoni de Sio (2020) A. Mecacci and B. Santoni de Sio  Reasons and control.",
    "Santoni de Sio and Mecacci (2021) B. Santoni de Sio and A. Mecacci  Four gaps.",
    "Santoni de Sio and van den Hoven (2018) B. Santoni de Sio and C. van den Hoven  Control.",
    "Van de Poel (2011) D. Van de Poel  Looking forward.",
    "Council of the European Union (2024) Council of the European Union  A regulation.",
    "Moss (2015) E. Moss  Margins.",
  );
  const body = [
    "Mecacci and Santoni de Sio (2020) separate near and far reasons.",
    "Santoni de Sio and Mecacci (2021) name four gaps, building on earlier work (Santoni de Sio and van den Hoven, 2018).",
    "Duties look forward, as Van de Poel (2011) argues.",
    "The rule was adopted by the Council of the European Union (2024).",
    "Answerability needs an occasion (Moss, 2015, pp. 67, 82).",
  ].join(" ");

  it("matches a particle surname, an organisation and a page list against the list", () => {
    assert.deepEqual(slipsOf(`# Control\n\n${body}\n${entries}`), []);
  });

  it("still reports the entries when their citations go", () => {
    const withoutParticles = body.replace("Duties look forward, as Van de Poel (2011) argues.", "").replace("(Santoni de Sio and van den Hoven, 2018)", "");
    assert.deepEqual(slipsOf(`# Control\n\n${withoutParticles}\n${entries}`), [
      ["uncited", "santoni 2018"],
      ["uncited", "van 2011"],
    ]);
  });

  it("still reports a particle surname cited in parentheses with a year the list does not have", () => {
    const wrongYear = body.replace("(Santoni de Sio and van den Hoven, 2018)", "(Santoni de Sio and van den Hoven, 2019)");
    assert.deepEqual(slipsOf(`# Control\n\n${wrongYear}\n${entries}`), [
      ["missing", "santoni 2019"],
      ["uncited", "santoni 2018"],
    ]);
  });

  it("reads the end of a longer name as unsure, and the words before it as its possible keys", () => {
    assert.deepEqual(keysIn("as Van de Poel (2011) argues"), [["poel?", "van?"]]);
    assert.deepEqual(keysIn("by the Council of the European Union (2024)."), [["union?", "council?", "european?"]]);
    assert.deepEqual(keysIn("Mecacci and Santoni de Sio (2020) separate"), [["sio?", "mecacci?", "santoni?"]]);
  });

  it("keeps a surname after one capitalised word of the sentence as the sure key", () => {
    assert.deepEqual(keysIn("As Smith (2020) shows."), [["smith"]]);
    assert.deepEqual(keysIn("Following Smith and Jones (2020), we test."), [["smith"]]);
    assert.deepEqual(keysIn("Results of Smith (2020) hold."), [["smith"]]);
    assert.deepEqual(keysIn("In van Dijk (2020) we read."), [["dijk?", "in?"]]);
  });

  it("still reports a one-word citation the list does not have", () => {
    assert.deepEqual(slipsOf(`# Control\n\n${body} As Brown (2019) shows.\n${entries}`), [["missing", "brown 2019"]]);
    assert.deepEqual(slipsOf(`# Control\n\n${body} Results of Brown (2019) hold.\n${entries}`), [["missing", "brown 2019"]]);
  });
});

describe("citation-reference-mismatch: an interval in brackets", () => {
  it("does not read [0,1] or [0, 100] as citations, and still reads [1, 2]", () => {
    assert.deepEqual(
      citationMarks("Scores lie in [0,1] and [0, 100]; see [1, 2].", [], WORDS).map((mark) => mark.written),
      ["[1, 2]"],
    );
    const source = `# Scores\n\nScores lie in [0,1] [1]. Ranks are cited too [2].\n${list("[1] Smith, A. 2019.", "[2] Jones, B. 2021.")}`;
    assert.deepEqual(slipsOf(source), []);
    assert.deepEqual(slipsOf(source.replace("[2].", "[3].")), [
      ["missing", "3"],
      ["uncited", "2"],
    ]);
  });
});
