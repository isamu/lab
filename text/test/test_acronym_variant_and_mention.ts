import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { caseVariantsIn, spelledOutAcronyms } from "../packages/chaff/src/detectors/acronym-mention.ts";
import { linkedListTerms } from "../packages/chaff/src/detectors/acronym-link.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// undefined-acronym: an acronym explained under another capitalisation (TCoP, then TCOP), one spelled out in a sentence about
// the abbreviation itself (the abbreviation DOB … date of birth), and a term in a list whose nested link names it (- GPL, then
// [GNU General Public License](…)). Every example is self-written.

const MENTIONS = ["abbreviation", "acronym", "stands for", "short for", "spell out"];

describe("undefined-acronym: the same acronym in other capitals", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not report an acronym expanded under another capitalisation", () => {
    assert.deepEqual(reportedAcronyms(en, "Follow the Service Design Code (SdCode) when you build.\n\nRead the SDCODE notes first.\n"), []);
    assert.deepEqual(reportedAcronyms(en, "Read the SDCODE notes first.\n\nFollow the Service Design Code (SdCode) when you build.\n"), []);
  });

  it("still reports it when no capitalisation is expanded", () =>
    assert.deepEqual(reportedAcronyms(en, "Read the SDCODE notes and the SdCode list.\n"), ["SDCODE"]));

  it("caseVariantsIn: other spellings with two capitals or more, as whole words", () => {
    assert.deepEqual(caseVariantsIn("the SdCode list, the SDCODE notes, Sdcode, sdcode, SdCodes", "SDCODE"), ["SdCode"]);
    assert.deepEqual(caseVariantsIn("only SDCODE here", "SDCODE"), []);
    assert.deepEqual(caseVariantsIn("", "SDCODE"), []);
  });
});

describe("undefined-acronym: a sentence about the abbreviation that spells it out", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("does not report an acronym a sentence about abbreviations writes out in words", () => {
    assert.deepEqual(reportedAcronyms(en, "Decide whether the abbreviation DOB is clear or whether to spell out date of birth.\n"), []);
    assert.deepEqual(reportedAcronyms(ja, "フォームの DOB は date of birth の略です。\n"), []);
  });

  it("still reports it without the words, without a word about abbreviations, or spelled only with its letters", () => {
    assert.deepEqual(reportedAcronyms(en, "Decide whether the abbreviation DOB is clear to every reader.\n"), ["DOB"]);
    assert.deepEqual(reportedAcronyms(en, "Check whether DOB is right for the date of birth.\n"), ["DOB"]);
    assert.deepEqual(reportedAcronyms(en, "Write abbreviations without full stops: QZB, not Q.Z.B.\n"), ["QZB"]);
  });

  it("spelledOutAcronyms reads only sentences with a mention", () => {
    assert.deepEqual([...spelledOutAcronyms(["The acronym SLO is short for service level objective."], MENTIONS)], ["SLO"]);
    assert.deepEqual([...spelledOutAcronyms(["The SLO is a service level objective."], MENTIONS)], []);
    assert.deepEqual([...spelledOutAcronyms([], MENTIONS)], []);
    assert.deepEqual([...spelledOutAcronyms(["The acronym SLO is short for service level objective."], [])], []);
  });
});

describe("undefined-acronym: a term in a list whose nested link names it", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const LICENCES = [
    "Licences we accept:",
    "",
    "- QPL",
    "  - [Quiet Public Licence version 2 | Licence Library](https://example.com/qpl)",
    "- ZXPL",
    "  - [About the ZXPL](https://example.com/zxpl/about)",
    "- QC-BY",
    "  - [Quiet Commons — Attribution 4.0 — QC BY 4.0](https://example.com/qc-by)",
    "",
  ].join("\n");

  it("does not report the terms whose nested link names them", () => assert.deepEqual(reportedAcronyms(en, LICENCES), []));

  it("still reports a term whose link does not name it, a link that is not nested, or a term in a sentence", () => {
    assert.deepEqual(reportedAcronyms(en, "Tools:\n\n- ZQX\n  - [Console](https://example.com/console)\n"), ["ZQX"]);
    assert.deepEqual(reportedAcronyms(en, "Tools:\n\n- ZQ\n  - [The zebra quilt](https://example.com/zq)\n"), ["ZQ"]);
    assert.deepEqual(reportedAcronyms(en, "Tools:\n\n- ZQX\n- [About the ZQX](https://example.com/zqx)\n"), ["ZQX"]);
    assert.deepEqual(reportedAcronyms(en, "- We use ZQX daily.\n  - [About the ZQX](https://example.com/zqx)\n"), ["ZQX"]);
  });

  it("linkedListTerms: by name, by initials, or by the term in the title", () => {
    assert.deepEqual([...linkedListTerms(LICENCES)], ["QPL", "ZXPL", "QC-BY"]);
    assert.deepEqual([...linkedListTerms("- QPL\n\n  - [Quiet Public Licence](https://example.com/qpl)\n")], []);
    assert.deepEqual([...linkedListTerms("")], []);
  });
});
