import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLinkLine } from "../packages/chaff/src/link-line.ts";
import { standaloneLines, subheadingPieces } from "../packages/chaff/src/subheading-line.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// リンクだけの行を 1 行ずつ並べた段落は、行ごとに一つの項目。例文はすべて自作。

await ja.prepare?.({ pos: true });

/** text の中のリンクの範囲。Markdown を読んだ文書が持つもの。 */
const linksIn = (text: string): readonly { start: number; end: number }[] => buildDocument("a.md", text, ja).links;

const lineAt = (text: string, line: string): { start: number; end: number } => {
  const start = text.indexOf(line);
  return { start, end: start + line.length };
};

describe("isLinkLine", () => {
  const text = "  [記事 1](https://a.example)  \n[記事](https://b.example) を読む\n[a](u) [b](v)\n\n";

  it("前後の空白を除いて一つのリンクだけの行", () => {
    assert.ok(isLinkLine(text, lineAt(text, "  [記事 1](https://a.example)  "), linksIn(text)));
  });

  it("リンクの外に字がある行、リンクが二つの行、空の行、リンクの無い文書は違う", () => {
    assert.ok(!isLinkLine(text, lineAt(text, "[記事](https://b.example) を読む"), linksIn(text)));
    assert.ok(!isLinkLine(text, lineAt(text, "[a](u) [b](v)"), linksIn(text)));
    assert.ok(!isLinkLine(text, { start: text.length - 1, end: text.length - 1 }, linksIn(text)));
    assert.ok(!isLinkLine(text, lineAt(text, "  [記事 1](https://a.example)  "), []));
  });
});

describe("standaloneLines / subheadingPieces with a line test", () => {
  const links = (text: string) => (start: number, end: number) => isLinkLine(text, { start, end }, linksIn(text));
  const pieces = (text: string): string[] => subheadingPieces(text, links(text)).map((span) => text.slice(span.start, span.end));

  it("段落の頭から並ぶリンクの行は、行ごとに切る", () => {
    const text = "[一](https://a.example)\n[二](https://b.example)\n[三](https://c.example)";
    assert.deepEqual(pieces(text), ["[一](https://a.example)", "[二](https://b.example)", "[三](https://c.example)"]);
  });

  it("文で終わる行や「：」で終わる行の後ろのリンクの行も切る", () => {
    assert.deepEqual(pieces("本文です。\n[一](https://a.example)\n次の文です。"), ["本文です。\n[一](https://a.example)", "次の文です。"]);
    assert.deepEqual(pieces("関連記事：\n[一](https://a.example)\n[二](https://b.example)"), [
      "関連記事：\n[一](https://a.example)",
      "[二](https://b.example)",
    ]);
  });

  it("文の途中で折り返した行の後ろのリンクは、文の中なので切らない", () => {
    const text = "詳しくは\n[資料](https://a.example)\nを見てください。";
    assert.deepEqual(pieces(text), [text]);
    assert.deepEqual(standaloneLines(text, links(text)), []);
  });

  it("行の判定が無ければ、小見出しの行だけを切る（これまでどおり）", () => {
    const text = "[一](https://a.example)\n[二](https://b.example)";
    assert.deepEqual(
      subheadingPieces(text).map((span) => text.slice(span.start, span.end)),
      [text],
    );
  });
});

describe("リンクだけの行を並べた段落", () => {
  const LIST = [
    "[Context Management 2025 - 第1回 モダンなContext Managementアーキテクチャ](https://example.com/1)",
    "[Context Management 2025 - 第2回 モダンなContext Managementアーキテクチャ](https://example.com/2)",
    "[Context Management 2025 - 第3回 モダンなContext Managementアーキテクチャ](https://example.com/3)",
    "[Context Management 2025 - 第4回 モダンなContext Managementアーキテクチャ](https://example.com/4)",
    "[Context Management 2025 - 第5回 モダンなContext Managementアーキテクチャ](https://example.com/5)",
  ].join("\n");
  const run = (source: string): string[] =>
    runRules(buildDocument("a.md", source, ja), loadRules("ja"), {}, true, "blog/tech").findings.map((finding) => finding.rule);
  const sentences = (source: string): number => buildDocument("a.md", source, ja).sentences.length;

  it("行ごとに一つの文で、長い文にも、同じ書き出しの連なりにもならない", () => {
    const source = `# 関連記事\n\n本文です。\n\n${LIST}\n`;
    assert.equal(sentences(source), 6);
    assert.ok(!run(source).includes("max-sentence-length"));
    assert.ok(!run(source).includes("repeated-sentence-head"));
  });

  it("箇条書きにした同じ行と同じ指摘", () => {
    const listed = `# 関連記事\n\n本文です。\n\n${LIST.split("\n")
      .map((line) => `- ${line}`)
      .join("\n")}\n`;
    assert.deepEqual(run(`# 関連記事\n\n本文です。\n\n${LIST}\n`), run(listed));
  });

  it("英語の文書でも行ごとに一つの文", () => {
    const source = "# Related\n\nSee also:\n\n[Part one of the series](https://a.example)\n[Part two of the series](https://b.example)\n";
    assert.equal(buildDocument("a.md", source, en).sentences.length, 3);
  });

  it("句点の無い本文の行は、これまでどおり一つの文", () => {
    assert.equal(sentences("# 試し\n\n長い文を\n途中で改行して\n書いています。\n"), 1);
  });
});
