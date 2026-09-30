import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { allFindings } from "../scripts/corpus-findings.ts";

// A library caller (and the corpus scripts) hands chaff the text as it is on disk: a BOM, CRLF or CR-only line ends.
// chaff reads it as the same document as the plain text, and every offset refers to doc.source, the plain text.

const BOM = String.fromCodePoint(0xfeff);

const REPORT = [
  "---",
  "genre: business/report",
  "---",
  "",
  "# Report",
  "",
  "The results are stated here, and the numbers were checked by the team before they were sent.",
  "",
  "This first sentence keeps going with one more clause and then another clause and yet another one until it is far longer than any reader would like it to be today.",
  "",
].join("\n");

const STATUTE = ["第一条　この法律は、第三条に定めるところによる。", "第二条　前条の規定は、第九条に準用する。", "第三条　同条の規定を適用する。", ""].join(
  "\n",
);

const crlf = (plain: string): string => plain.replace(/\n/gu, "\r\n");

const variants = (plain: string): readonly (readonly [string, string])[] => [
  ["CRLF", crlf(plain)],
  ["CR", plain.replace(/\n/gu, "\r")],
  ["BOM", `${BOM}${plain}`],
  ["BOM and CRLF", `${BOM}${crlf(plain)}`],
];

const documentOf = (path: string, source: string, language: "ja" | "en", genre: string) => {
  const adapter = language === "ja" ? ja : en;
  return buildDocument(path, source, adapter, undefined, profileFor(EMPTY, path, source, language, genre));
};

describe("buildDocument reads a BOM and CRLF / CR line ends as the plain text", () => {
  variants(REPORT).forEach(([label, raw]) => {
    it(`${label}: the same document as the plain text (Markdown)`, () => {
      const plain = documentOf("a.md", REPORT, "en", "business/report");
      const read = documentOf("a.md", raw, "en", "business/report");
      assert.equal(read.source, REPORT);
      assert.equal(JSON.stringify(read), JSON.stringify(plain));
    });
  });

  variants(STATUTE).forEach(([label, raw]) => {
    it(`${label}: the same statute, profile and structure tree as the plain text`, () => {
      const plain = documentOf("law.txt", STATUTE, "ja", "legal/statute");
      const read = documentOf("law.txt", raw, "ja", "legal/statute");
      assert.notEqual(read.profile, undefined);
      assert.equal(read.profile?.id, plain.profile?.id);
      assert.equal(JSON.stringify(read.structure), JSON.stringify(plain.structure));
      assert.equal(JSON.stringify(read), JSON.stringify(plain));
    });

    it(`${label}: profileFor detects a statute from its lines without being told the genre`, () => {
      const detected = profileFor(EMPTY, "law.txt", raw, "ja");
      assert.notEqual(detected, undefined);
      assert.equal(detected?.id, profileFor(EMPTY, "law.txt", STATUTE, "ja")?.id);
    });
  });

  it("offsets refer to doc.source: every sentence's span slices its text out of it", () => {
    const doc = documentOf("a.md", `${BOM}${crlf(REPORT)}`, "en", "business/report");
    assert.ok(doc.sentences.length > 0);
    doc.sentences.forEach((sentence) => assert.equal(doc.source.slice(sentence.span.start, sentence.span.end), sentence.text));
  });

  it("the findings of a CRLF document fall on the same lines and columns as the plain text's", () => {
    const rules = loadRules("en");
    const run = (source: string) => runRules(documentOf("a.md", source, "en", "business/report"), rules, {}, false, "business/report").findings;
    const plain = run(REPORT);
    assert.ok(plain.length > 0);
    assert.deepEqual(run(crlf(REPORT)), plain);
  });
});

describe("the corpus scripts read CRLF and BOM text like the command line", () => {
  it("allFindings of a CRLF statute with a BOM", async () => {
    const plain = await allFindings("law.txt", STATUTE, "ja", "legal/statute");
    assert.deepEqual(await allFindings("law.txt", `${BOM}${crlf(STATUTE)}`, "ja", "legal/statute"), plain);
  });
});
