import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { htmlTextBlocks } from "../packages/chaff/src/structure/html-text-blocks.ts";

// numbering-gap: CommonMark の HTML ブロックは、タグだけの行（<br/>）から次の空行まで続く。その下に書いた条は読み手には見えるが、
// chaff の木には入らない。そこを挟んだ抜けは言わない。例文は自作。

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (source: string, path = "c.md"): [unknown, unknown][] =>
  runRules(buildDocument(path, source, ja), loadRules(ja.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const contract = (between: readonly string[], third = "第３条（解除）"): string =>
  lines(
    "# 業務委託契約書",
    "",
    "第１条（目的）",
    "",
    "本契約は、業務の委託について定める。",
    "",
    ...between,
    "",
    third,
    "",
    "甲は、乙が本契約に違反したときは、本契約を解除できる。",
  );

before(async () => prepare());

describe("numbering-gap: an article inside an HTML block", () => {
  it("does not report a gap whose missing article sits right under a <br/>", () => {
    const source = contract(["<br/>", "第２条（納期）", "乙は、期日までに納品する。"]);
    assert.deepEqual(gapsOf(source), []);
  });

  it("does not report it when the hidden article sits in a centred block with a section title", () => {
    const source = contract(['<p align="center">', "第２節　納品", "</p>", "<br/>", "第２条（納期）"]);
    assert.deepEqual(gapsOf(source), []);
  });

  it("still reports a gap across a <br/> block that shows nothing", () => {
    const source = contract(["<br/>", "", "<br/>"]);
    assert.deepEqual(gapsOf(source), [["第１条", "第３条"]]);
  });

  it("still reports a gap whose missing article is commented out: the reader does not see it", () => {
    const source = contract(["<!--", "第２条（納期）", "-->"]);
    assert.deepEqual(gapsOf(source), [["第１条", "第３条"]]);
  });

  it("still reports a repeated number across a block that shows text", () => {
    const source = lines("# 業務委託契約書", "", "第１条（目的）", "", "第２条（納期）", "", "<br/>", "第２節　支払", "", "第２条（代金）");
    assert.deepEqual(gapsOf(source), [["第２条", "第２条"]]);
  });

  it("still reports a gap after an inline <br/> inside a paragraph", () => {
    const source = contract(["乙は、期日までに納品する。<br/>", "納品の場所は甲の事務所とする。"]);
    assert.deepEqual(gapsOf(source), [["第１条", "第３条"]]);
  });

  it("a plain-text document has no HTML blocks: the gap is reported there", () => {
    const source = contract(["<br/>", "乙は、期日までに納品する。"]);
    assert.deepEqual(gapsOf(source, "c.txt"), [["第１条", "第３条"]]);
  });
});

describe("htmlTextBlocks", () => {
  it("returns a block that shows text and leaves out tags, comments and &nbsp; alone", () => {
    const source = lines("<br/>", "見える文字", "", "<br/>", "", "<!-- 見えない -->", "", "<div>&nbsp;</div>", "", "本文<br/>続き");
    assert.deepEqual(
      htmlTextBlocks(source).map((span) => source.slice(span.start, span.end)),
      ["<br/>\n見える文字"],
    );
  });

  it("a `>` inside a quoted attribute does not leave text behind", () => {
    assert.deepEqual(htmlTextBlocks(lines('<div title=">">', "</div>")), []);
  });

  it("returns nothing for a source without a tag", () => {
    assert.deepEqual(htmlTextBlocks("第１条\n\n第３条"), []);
  });
});
