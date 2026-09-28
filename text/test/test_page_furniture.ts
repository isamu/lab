import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pageFurniture } from "../packages/chaff/src/page-furniture.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import type { StructureNode } from "../packages/chaff/src/plugin.ts";

// 紙の版を写したテキスト（RFC）のページのヘッダーとフッター。改ページ（\f）の直前と直後の、空でない 1 行ずつ。

const lines = (...rows: string[]): string => rows.join("\n");

const PAGED = lines(
  "The first page ends here.",
  "",
  "Author, et al.              Informational                      [Page 1]",
  "\f",
  "RFC 9999                  Some Requirements                 May 2026",
  "",
  "The second page begins here.",
);

const spanTexts = (source: string): string[] => pageFurniture(source).map((span) => source.slice(span.start, span.end));

describe("pageFurniture", () => {
  it("改ページの直前と直後の、空でない 1 行ずつと、改ページの行", () => {
    assert.deepEqual(spanTexts(PAGED), [
      "Author, et al.              Informational                      [Page 1]",
      "\f",
      "RFC 9999                  Some Requirements                 May 2026",
    ]);
  });

  it("改ページが無ければ何も無い。飾りが遠すぎる（4 行以上の空行の先）なら取らない", () => {
    assert.deepEqual(spanTexts("本文だけ。\n次の行。"), []);
    assert.deepEqual(spanTexts(lines("Body.", "", "", "", "", "\f", "Next.")), ["\f", "Next."]);
  });

  it("文書の先頭と末尾の改ページでも止まる", () => {
    assert.deepEqual(spanTexts("\f\nHeader line"), ["\f", "Header line"]);
    assert.deepEqual(spanTexts("Footer line\n\f"), ["Footer line", "\f"]);
  });

  it("行の途中の \\f はページの区切りではない", () => {
    assert.deepEqual(spanTexts(lines("Before.", "This sentence has a page\fbreak in it.", "After.")), []);
  });
});

describe("テキストの文書では、ページの飾りを本文として読まない", () => {
  const sentencesOf = (path: string): string[] => buildDocument(path, PAGED, en).sentences.map((sentence) => sentence.text.trim());

  it(".txt では飾りの行が文に入らない", () => {
    const joined = sentencesOf("rfc.txt").join(" | ");
    assert.doesNotMatch(joined, /Informational|\[Page 1\]|Some Requirements/u);
    assert.match(joined, /The first page ends here\./u);
    assert.match(joined, /The second page begins here\./u);
  });

  it("Markdown はそのまま（改ページを使わない）", () => {
    assert.match(sentencesOf("rfc.md").join(" | "), /Informational/u);
  });
});

describe("木もページの飾りを読まない", () => {
  it("フッターの「Section 9」は節にならず、Section 9 への参照は参照先が無い", () => {
    const source = lines(
      "Section 1 Scope",
      "text",
      "Section 2 Terms",
      "See Section 9.",
      "",
      "Section 9 Footer",
      "\f",
      "Header line",
      "",
      "Section 3 Fees",
      "text",
    );
    const findings = runRules(buildDocument("c.txt", source, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "dangling-reference",
    );
    assert.deepEqual(
      findings.map((finding) => finding.values["target"]),
      ["9"],
    );
  });

  it("chaff tree の入口（buildStructure）でも、フッターは節にならない", () => {
    const addresses = (node: StructureNode): string[] => [...(node.address === "" ? [] : [node.address]), ...node.children.flatMap(addresses)];
    const source = lines("Section 1 Scope", "text", "", "Section 9 Footer", "\f", "Header line", "", "Section 2 Terms", "text");
    const tree = buildStructure({ path: "c.txt", source, language: "en", markdown: false }, en.structure ?? assert.fail("lang-en has no structure"));
    assert.deepEqual(addresses(tree), ["1", "2"]);
  });

  it("読めなかった構造の判定も、ページの飾りを数えない（飾りの番号で構造の rule を止めない）", () => {
    // 行頭に番号のあるフッターがページの数だけ並ぶ。伏せずに数えると「条が本文にあるのに木に入っていない」に見える。
    const page = (n: number): string[] => [`9.${String(n)} FOOTER OF THE PAGE`, "\f", `Header ${String(n)}`, ""];
    const pages = Array.from({ length: 20 }, (_, index) => page(index + 1)).flat();
    const source = lines("1.1 Scope", "text", "1.2 Terms", "See 1.9.", "", ...pages, "1.3 Fees", "text");
    const result = runRules(buildDocument("c.txt", source, en), loadRules("en"), {}, true, "technical/spec");
    assert.deepEqual(
      result.skipped.filter((skip) => skip.rule === "dangling-reference"),
      [],
    );
  });
});
