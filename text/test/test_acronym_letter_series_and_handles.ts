import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { headingSeries, numberedSeries } from "../packages/chaff/src/detectors/acronym-series.ts";
import { referenceEntryLabels } from "../packages/chaff/src/detectors/reference-entry.ts";

// undefined-acronym and capitals that are not prose shorthand: a letter's number in its series, a time zone after a time the
// sentence splitter cut at p.m., a phone label before its number, a social handle, a name in 『』, a reference list's label,
// a code's name the document cites, and an acronym expanded in full-width letters. Excerpts are from US federal documents
// (Federal Reserve letters, a CFPB blog, a GSA press release, the eCFR), a Japanese FSA page (public domain), or self-written.

const doc = (...body: string[]): string => ["# Notes", "", ...body, "", "The SRE joins the call."].join("\n");
const jaDoc = (...body: string[]): string => ["# 連絡", "", ...body, "", "SREが対応する。"].join("\n");

describe("numberedSeries: a letter's number", () => {
  it("valid: capitals before two letters' numbers (a two-digit year and the place in it)", () => {
    assert.deepEqual([...numberedSeries("- SR 24-2 / CA 24-1, Guide\n- SR 23-4, Guidance\n- CA 24-2, Guidance")], ["SR", "CA"]);
  });

  it("invalid: one letter, a range, scores with a one-digit first number", () => {
    assert.deepEqual([...numberedSeries("See SR 24-2. Again, SR 24-2.")], []);
    assert.deepEqual([...numberedSeries("the SLO 10-20 band and the SLO 30-40 band")], []);
    assert.deepEqual([...numberedSeries("NFL 3-1 and NFL 2-0")], []);
  });
});

describe("headingSeries", () => {
  it("valid: a heading opened by a letter's number and a colon", () => {
    assert.deepEqual([...headingSeries(["Supervision and Regulation Letters", "SR 26-8: Updates to the Expanded Examination Cycle"])], ["SR"]);
  });

  it("invalid: a plain number, no colon, capitals alone", () => {
    assert.deepEqual([...headingSeries(["KPI 1: Revenue", "SR 26-8 Updates", "CA: Overview"])], []);
  });

  it("abnormal input: no headings, empty headings", () => {
    assert.deepEqual([...headingSeries([])], []);
    assert.deepEqual([...headingSeries(["", " "])], []);
  });
});

describe("referenceEntryLabels", () => {
  it("valid: the label of an entry with a wide gap", () => {
    assert.deepEqual([...referenceEntryLabels('   [UNIX]     The Open Group, "The Single UNIX Specification", 1997.')], ["UNIX"]);
  });

  it("invalid: a link definition, a label in prose", () => {
    assert.deepEqual([...referenceEntryLabels("[UNIX]: https://example.com/")], []);
    assert.deepEqual([...referenceEntryLabels("[UNIX] says so.")], []);
  });

  it("abnormal input: empty text", () => {
    assert.deepEqual([...referenceEntryLabels("")], []);
  });
});

describe("undefined-acronym: letter numbers named by the page", () => {
  it("valid: the letter's own number under a heading that titles it, and other letters cited by number", () => {
    const sr = [
      "## Supervision and Regulation Letters",
      "",
      "### SR 26-8: Updates to the Expanded Examination Cycle",
      "",
      "SR 26-8",
      "October 14, 2026",
      "",
      "The SRE joins the call.",
    ];
    assert.deepEqual(reportedAcronyms(en, sr.join("\n")), ["SRE"]);
    const ca = [
      "## Consumer Affairs Letters",
      "",
      "### CA 24-5: Joint Statement",
      "",
      "CA 24-5",
      "",
      "- SR 24-2 / CA 24-1, “Third-Party Risk Management”",
      "- SR 23-4, “Interagency Guidance”",
    ];
    assert.deepEqual(reportedAcronyms(en, [...ca, "", "The SRE joins the call."].join("\n")), ["SRE"]);
  });

  it("invalid: one cited letter, a numbered heading", () => {
    assert.deepEqual(reportedAcronyms(en, doc("See SR 24-2 for the guide.")), ["SR", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, ["## KPI 1: Revenue", "", "The KPI grows. The SRE joins the call."].join("\n")), ["KPI", "SRE"]);
  });
});

describe("undefined-acronym: a time zone after p.m., a phone label, a handle, a name in 『』", () => {
  it("valid: the shape around the capitals says what they are", () => {
    const cfpb = "You can call our consumer call center at (855) 411-2372 between 8 a.m. and 8 p.m. ET, Monday through Friday.";
    assert.deepEqual(reportedAcronyms(en, doc(cfpb)), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("For more information, visit GSA.gov and follow us at @USGSA.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("金融サービス利用者相談室", "TEL  03-3222-1061 ※月～金曜日 9:30～17:30")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("FAX：０３－３２２２－１０６２")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("TEL：03-〇〇〇〇-〇〇〇〇")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("新たな中期３ヵ年計画『SHIFT』をスタートしました。")), ["SRE"]);
  });

  it("invalid: the same capitals without the shape", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The ET team meets on Monday.")), ["ET", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("TELの担当者が対応します。")), ["TEL", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("TEL 123 で受け付けます。")), ["TEL", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("Email OPS@example.gov or ask the OPS desk.")), ["OPS", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("『DX推進の手引き』を読んだ。")), ["DX", "SRE"]);
  });
});

describe("undefined-acronym: a reference label, a cited code, a full-width expansion", () => {
  it("valid: the document says what the capitals are elsewhere", () => {
    const references = [
      "# Notes",
      "",
      "Why not a UNIX timestamp? The SRE joins the call.",
      "",
      '   [UNIX]     The Open Group, "The Single UNIX Specification", 1997.',
    ];
    assert.deepEqual(reportedAcronyms(en, references.join("\n")), ["SRE"]);
    const ecfr = "Regulation E, 12 CFR 1005.20, covers gift cards. For citations, see the List of CFR Sections Affected.";
    assert.deepEqual(reportedAcronyms(en, doc(ecfr)), ["SRE"]);
    const fsa = "(※１)　 ＩＣＯ（Initial Coin Offering）は、一般に、企業等がトークンを発行して資金調達を行う行為の総称。";
    assert.deepEqual(reportedAcronyms(ja, jaDoc(fsa, "", "ICOで発行された暗号資産を購入した。")), ["SRE"]);
  });

  it("invalid: no entry, no citation, no expansion", () => {
    assert.deepEqual(reportedAcronyms(en, doc("Why not a UNIX timestamp?")), ["UNIX", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("For citations, see the List of CFR Sections Affected.")), ["CFR", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("ＩＣＯは資金調達の一つ。ICOで発行された暗号資産を購入した。")), ["ICO", "SRE"]);
  });
});
