import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { duplicateDefinitions } from "../packages/chaff/src/structure/issues.ts";
import type { StructurePatterns } from "../packages/chaff/src/plugin.ts";

// How far a definition holds: "In this Part—" holds in the Part, "In this section—" in the section.

const patterns = (): StructurePatterns => {
  if (en.structure === undefined) throw new Error("lang-en has no structure");
  return en.structure;
};

const lines = (...rows: string[]): string => rows.join("\n");

const duplicates = (source: string): string[] =>
  duplicateDefinitions(buildStructure({ path: "c.txt", source, language: "en", markdown: false }, patterns())).map((issue) => String(issue.values["term"]));

// Shaped like the Data Protection Act 2018 (Open Government Licence v3.0): each Part defines its own terms.
const act = (...parts: string[][]): string => lines(...parts.flat());

describe("a definition's scope in English statutes", () => {
  it("a word defined twice in one Part, in different sections, is reported", () => {
    const source = act([
      "PART 2 General processing",
      "Section 3 Terms",
      "(1) In this Part—",
      "“controller” means the person who decides.",
      "Section 4 More terms",
      "(1) In this Part—",
      "“controller” means someone else.",
    ]);
    assert.deepEqual(duplicates(source), ["controller"]);
  });

  it("the same word defined in two Parts is not compared", () => {
    const source = act(
      ["PART 2 General processing", "Section 3 Terms", "(1) In this Part—", "“controller” means the person who decides."],
      ["PART 3 Law enforcement processing", "Section 32 Terms", "(1) In this Part—", "“controller” means the competent authority."],
    );
    assert.deepEqual(duplicates(source), []);
  });

  it("in a Part that scopes one section, another section's definition is still compared across the document", () => {
    const source = act(
      ["PART 2 General processing", "Section 3 Terms", "(1) In this Part—", "“controller” means the person who decides."],
      ["Section 4 Records", "“data” means records."],
      ["PART 3 Law enforcement processing", "Section 32 Terms", "“data” means information."],
    );
    assert.deepEqual(duplicates(source), ["data"]);
  });

  it("a scope line under a Markdown heading, with no numbered section, holds in its Part", () => {
    const source = lines(
      "# PART 1 One",
      "## Terms",
      "In this Part—",
      "“controller” means one.",
      "# PART 2 Two",
      "## Terms",
      "In this Part—",
      "“controller” means two.",
    );
    const tree = buildStructure({ path: "c.md", source, language: "en", markdown: true }, patterns());
    assert.deepEqual(duplicateDefinitions(tree), []);
    const twice = lines("# PART 1 One", "## Terms", "In this Part—", "“controller” means one.", "## More terms", "In this Part—", "“controller” means two.");
    const again = buildStructure({ path: "c.md", source: twice, language: "en", markdown: true }, patterns());
    assert.deepEqual(
      duplicateDefinitions(again).map((issue) => issue.values["term"]),
      ["controller"],
    );
  });

  it("outside a numbered section, a scope line holds in the Markdown section it is under", () => {
    const source = lines("## Terms", "In this section—", "“x” means a.", "## Other terms", "In this section—", "“x” means b.");
    const tree = buildStructure({ path: "c.md", source, language: "en", markdown: true }, patterns());
    assert.deepEqual(duplicateDefinitions(tree), []);
  });

  it("“In this section” still holds only in the section", () => {
    const source = act([
      "PART 2 General processing",
      "Section 3 Terms",
      "(1) In this section—",
      "“controller” means one thing.",
      "Section 4 Terms",
      "(1) In this section—",
      "“controller” means another.",
    ]);
    assert.deepEqual(duplicates(source), []);
  });

  it("“In this Chapter” holds in the Chapter", () => {
    const chapter = (number: number, section: number): string[] => [
      `CHAPTER ${String(number)} Scope`,
      `Section ${String(section)} Terms`,
      "(1) In this Chapter—",
      "“data” means information.",
    ];
    assert.deepEqual(duplicates(act(["PART 2 General"], chapter(1, 3), chapter(2, 5))), []);
    assert.deepEqual(duplicates(act(["PART 2 General"], chapter(1, 3), ["Section 4 More", "(1) In this Chapter—", "“data” means records."])), ["data"]);
  });
});
