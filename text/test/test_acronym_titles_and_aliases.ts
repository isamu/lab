import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { linkTitleSpans } from "../packages/chaff/src/detectors/acronym-link.ts";
import { expansionAt } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { placeholderSpans } from "../packages/chaff/src/detectors/placeholder.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym: what is no acronym to expand, or is expanded in a form chaff did not read. Self-written text only.
//   a file name (README), a licence's name (MIT License), a loanword (NPO), a template's placeholder (OOOO, XX 月),
//   the title of a linked page ([Writing for the ABC Web](https://…)), which still counts towards the limit,
//   "Special Interest Groups, or SIGs", and a name defined in a later heading (Community Review Board (“Community CRB”)).

const PENDING = { en: "The SRE, XYZ and QRS are pending.", ja: "SRE、XYZ、QRSは保留。" };

describe("undefined-acronym: words a reader knows (lexicon)", () => {
  it("README, MIT and, in Japanese, NPO and NGO are not reported; SRE still is", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nRead the README first. The code is under the MIT License. ${PENDING.en}\n`), ["SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(ja, `# T\n\nREADMEを読む。MIT Licenseで公開する。NPOやNGOと組む。${PENDING.ja}\n`), ["SRE", "XYZ", "QRS"]);
  });
});

describe("undefined-acronym: a template's placeholder", () => {
  it("O or X written four times or more stands for a name to fill in (OOOO)", () => {
    assert.deepEqual(reportedAcronyms(ja, `# 規約\n\n登録者は OOOO を使うにあたり、本規約に同意します。SREも見ます。\n`), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, `# Terms\n\nBy using XXXX you agree to these terms. The SRE joins.\n`), ["SRE"]);
  });

  it("a repeat before a date unit with a space between (XX 月 XX 日)", () => {
    assert.deepEqual(reportedAcronyms(ja, `# 規約\n\nXXXX 年 XX 月 XX 日 初版。SREも見ます。\n`), ["SRE"]);
  });

  it("an acronym of three repeated letters, or of different letters, is still counted", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nThe AAA and the CCC met. The SRE joins.\n`), ["AAA", "CCC", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, `# T\n\nQZ 月報とWK 日報。SREも見ます。\n`), ["QZ", "WK", "SRE"]);
  });

  it("placeholderSpans: the long repeat alone, and a unit after one space", () => {
    const units = ["年", "月", "日"];
    assert.deepEqual(placeholderSpans("use OOOO now", units), [{ start: 4, end: 8 }]);
    assert.deepEqual(placeholderSpans("XX 月", units), [{ start: 0, end: 2 }]);
    assert.deepEqual(placeholderSpans("OOO and XX  月", units), []);
    assert.deepEqual(placeholderSpans("OOOOx", units), []);
    assert.deepEqual(placeholderSpans("Part IIII and Volume MMMMM", units), []);
  });
});

describe("undefined-acronym: the title of a linked page", () => {
  it("an acronym in the title of an outside page is not counted", () => {
    const source = `# T\n\n- [Writing for the ABC Web](https://example.com/a)\n- [Tips - Dev Notes | QRS](https://example.com/b)\n\nThe SRE joins.\n`;
    assert.deepEqual(reportedAcronyms(en, source), ["SRE"]);
  });

  it("a link in a sentence, a link inside the document, and running text are still counted", () => {
    const source = `# T\n\nSee [ABC Web](https://example.com/a), the [QRS notes](./notes.md) and the XYZ team.\n`;
    assert.deepEqual(reportedAcronyms(en, source), ["ABC", "QRS", "XYZ"]);
  });

  it("a title's acronyms count towards the limit, so the writer's own acronym is still reported", () => {
    const words = (source: string): string[] =>
      runRules(buildDocument("t.md", source, en), loadRules("en"), { "undefined-acronym": "normal" }, false, "business/report")
        .findings.filter((finding) => finding.rule === "undefined-acronym")
        .map((finding) => `${String(finding.values["word"])}:${String(finding.values["count"])}`);
    const titles = "- [Writing for the ABC Web](https://example.com/a)\n- [Tips for QRS Teams](https://example.com/b)\n";
    assert.deepEqual(words(`# T\n\nThe SRE joins.\n\n${titles}`), ["SRE:3"]);
    assert.deepEqual(words(`# T\n\nThe SRE joins.\n`), []);
  });

  it("linkTitleSpans: only an outside link that stands alone on its line", () => {
    const lines = ["- [ABC Web](https://x.org)", "  1. [ABC](https://x.org).", "See [ABC Web](https://x.org) here", "- [ABC Web](./a.md)", "- [ABC Web][ref]"];
    const source = lines.join("\n");
    const links = lines.map((line) => {
      const start = source.indexOf(line) + line.indexOf("[");
      const close = line.indexOf(")", line.indexOf("[")) + 1 || line.length;
      return { start, end: source.indexOf(line) + close };
    });
    const texts = linkTitleSpans(source, links).map((span) => source.slice(span.start, span.end));
    assert.deepEqual(texts, ["ABC Web", "ABC"]);
    assert.deepEqual(linkTitleSpans("", []), []);
    assert.deepEqual(linkTitleSpans("[broken", [{ start: 0, end: 7 }]), []);
  });
});

describe("undefined-acronym: Name, or ACRONYMs", () => {
  it("the name and the acronym after a comma and or, wrapped across a line, in the plural", () => {
    const source = `# T\n\nSee the SIG rules below.\n\nThe project has Special Interest\nGroups, or SIGs. The SRE joins.\n`;
    assert.deepEqual(reportedAcronyms(en, source), ["SRE"]);
  });

  it("ja: 名前、通称 略語", () => {
    assert.deepEqual(reportedAcronyms(ja, `# T\n\nSIGの規則を見る。\n\nSpecial Interest Group、通称SIGを置く。SREも見ます。\n`), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, `# T\n\nSIGの規則を見る。\n\n審査委員会、通称SIGを置く。SREも見ます。\n`), ["SIG", "SRE"]);
  });

  it("the plural in brackets explains the singular", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nSee the SIG rules.\n\nWe have Special Interest Groups (SIGs). The SRE joins.\n`), ["SRE"]);
  });

  it("or without a comma, or a name whose initials differ, is no expansion", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nSee the SIG rules.\n\nThe Special Interest Groups or SIGs meet. The SRE joins.\n`), ["SIG", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\nSee the SIG rules.\n\nAsk the Review Board, or SIGs. The SRE joins.\n`), ["SIG", "SRE"]);
  });

  it("expansionAt reads the form only with the language's words", () => {
    const text = "Special Interest Groups, or SIG.";
    assert.equal(expansionAt({ markers: [], verbs: [], alternatives: ["or"] })(text, "SIG", text.indexOf("SIG")), true);
    assert.equal(expansionAt({ markers: [], verbs: [] })(text, "SIG", text.indexOf("SIG")), false);
  });
});

describe("undefined-acronym: a name and its acronym together in brackets", () => {
  it("a heading that defines the acronym after its first use", () => {
    const source = `# T\n\n- Send one member to the Community CRB.\n- The SRE joins.\n\n## 8. Community Review Board (“Community CRB”)\n\nThe Community CRB meets.\n`;
    assert.deepEqual(reportedAcronyms(en, source), ["SRE"]);
  });

  it("words in the brackets that the name before them does not hold are no expansion", () => {
    const source = `# T\n\nThe CRB meets. The SRE joins.\n\n## Review Board (“Community CRB”)\n`;
    assert.deepEqual(reportedAcronyms(en, source), ["CRB", "SRE"]);
  });
});
