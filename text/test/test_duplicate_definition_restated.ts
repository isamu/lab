import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { duplicateDefinitions } from "../packages/chaff/src/structure/issues.ts";
import type { StructurePatterns } from "../packages/chaff/src/plugin.ts";

// duplicate-definition: the same name restating the same term (a subject line and the body of a letter) is one
// definition written twice, not two that may disagree. Excerpts from Federal Reserve SR 25-3 (a U.S. government work).

const patterns = (): StructurePatterns => {
  if (en.structure === undefined) throw new Error("lang-en has no structure");
  return en.structure;
};

const duplicates = (...rows: string[]): string[] =>
  duplicateDefinitions(buildStructure({ path: "c.txt", source: rows.join("\n"), language: "en", markdown: false }, patterns()), [], rows.join("\n")).map(
    (issue) => String(issue.values["term"]),
  );

const SUBJECT = `Imposition of Special Measures by the U.S. Department of the Treasury's Financial Crimes Enforcement Network ("FinCEN")`;
const BODY = `The purpose of this letter is to advise institutions of the special measures imposed by the U.S. Department of the Treasury's Financial Crimes Enforcement Network ("FinCEN") under section 311 of the USA PATRIOT Act.`;
const SUPERSEDES = `SR letter 16-13, "Imposition of Special Measures by the U.S. Department of the Treasury's Financial Crimes Enforcement Network ("FinCEN")"`;

describe("duplicate-definition: the same name restating the same term", () => {
  it("a subject line and the body that define FinCEN after the same name are one definition", () => {
    assert.deepEqual(duplicates("SUBJECT:", "", SUBJECT, "", BODY), []);
  });

  it("a quoted title of another letter carrying the same definition is not a second one", () => {
    assert.deepEqual(duplicates(BODY, "", "Supersedes:", "", SUPERSEDES), []);
  });

  it("the same term after a different name is still reported", () => {
    assert.deepEqual(duplicates(BODY, "", `The Federal Communications Network ("FinCEN") publishes the list.`), ["FinCEN"]);
  });

  it("names that differ only before a small word (Office on / Bureau in Civil Rights) are different names", () => {
    assert.deepEqual(duplicates(`The Office on Civil Rights ("OCR") reviews the claim.`, "", `The Bureau in Civil Rights ("OCR") files the report.`), ["OCR"]);
  });

  it("the same term after a lower-case description names nothing, and is still reported", () => {
    assert.deepEqual(
      duplicates(`Acme Holdings, a Delaware corporation (the "Company"), agrees.`, "", `Beta Industries, a Delaware corporation (the "Company"), agrees.`),
      ["Company"],
    );
  });

  it("a 'means' definition repeated with the same words is still reported", () => {
    assert.deepEqual(duplicates(`"Service" means the booking website we run.`, "", `"Service" means the booking website we run.`), ["Service"]);
  });

  it("without the source, every second definition is reported as before", () => {
    const source = [SUBJECT, "", BODY].join("\n");
    const tree = buildStructure({ path: "c.txt", source, language: "en", markdown: false }, patterns());
    assert.deepEqual(
      duplicateDefinitions(tree).map((issue) => String(issue.values["term"])),
      ["FinCEN"],
    );
  });
});
