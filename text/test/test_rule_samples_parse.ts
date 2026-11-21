import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blocksOf, sampleArgs, sampleOf, screenOf, withBlock } from "../scripts/samples-parse.ts";

// 見本のファイルから、機械が読む所（冒頭の注釈と chaff- の付いた塊）を取り出す決まり。

const SAMPLE = [
  "<!-- chaff-sample",
  "rule: undefined-acronym",
  "genre: business/report",
  "-->",
  "",
  "````markdown chaff-before",
  "Our CSAT rose.",
  "```bash",
  "```text chaff-output",
  "```",
  "````",
  "",
  "```markdown chaff-after",
  "Our customer satisfaction score rose.",
  "```",
  "",
  "```text chaff-output",
  "old",
  "```",
  "",
  "```yaml chaff-settings",
  "rules:",
  "  undefined-acronym: relaxed",
  "```",
  "",
].join("\n");

describe("見本の読み取り", () => {
  it("冒頭の注釈と、塊の中身を読む。長い囲みの中の短い囲みは中身", () => {
    const sample = sampleOf(SAMPLE, "s.md");
    assert.deepEqual(sample.meta, { rule: "undefined-acronym", genre: "business/report", file: "draft.md", afterAllows: [] });
    assert.equal(sample.before, "Our CSAT rose.\n```bash\n```text chaff-output\n```\n");
    assert.equal(sample.after, "Our customer satisfaction score rose.\n");
    assert.deepEqual(sample.settings, ["rules:\n  undefined-acronym: relaxed\n"]);
    assert.equal(sample.config, undefined);
    assert.deepEqual(
      blocksOf(SAMPLE, "s.md").map((block) => block.tag),
      ["chaff-before", "chaff-after", "chaff-output", "chaff-settings"],
    );
  });

  it("出力の塊だけを書き換え、ほかは一字も動かさない", () => {
    const updated = withBlock(SAMPLE, "chaff-output", "new\n", "s.md");
    assert.equal(updated, SAMPLE.replace("```text chaff-output\nold\n```", "```text chaff-output\nnew\n```"));
  });

  it("走らせる引数は、ジャンル、文書、ほかの文書の順", () => {
    assert.deepEqual(sampleArgs(sampleOf(SAMPLE, "s.md")), ["--no-guide", "--genre", "business/report", "draft.md"]);
  });

  it("注釈が無い、rule が無い、塊が閉じない、塊が二つある見本は、ファイルの名前を添えて止まる", () => {
    assert.throws(() => sampleOf(SAMPLE.replace("<!-- chaff-sample", "<!-- note"), "s.md"), /s\.md: the file must open/u);
    assert.throws(() => sampleOf(SAMPLE.replace("rule: undefined-acronym\n", ""), "s.md"), /s\.md: the chaff-sample comment needs rule:/u);
    assert.throws(() => blocksOf("```text chaff-output\nnever closed\n", "s.md"), /s\.md: the chaff-output block on line 1 is never closed/u);
    assert.throws(() => sampleOf(`${SAMPLE}\n\`\`\`markdown chaff-after\nagain\n\`\`\`\n`, "s.md"), /exactly one .* chaff-after block, found 2/u);
    assert.throws(() => sampleOf(SAMPLE.replace("genre: business/report", "genre: business/report\nafter_allows: other"), "s.md"), /after_allows is a list/u);
  });

  it("画面は文書の見出しの行から「書き換えていません」の行までで、動かなかった rule の一覧は載せない", () => {
    const output = [
      "  SARIF を書きました: a.sarif（1 件）",
      "",
      "a.md   blog/tech · 日本語",
      "",
      "  指摘",
      "  文章は書き換えていません。直すのは書いた人です。  ",
      "",
      "  73 件の rule は動いていません:",
      "      x（理由）",
    ].join("\n");
    assert.equal(
      screenOf("$ npx chaffjs a.md", output, ["a.md"], "s.md"),
      "$ npx chaffjs a.md\n\na.md   blog/tech · 日本語\n\n  指摘\n  文章は書き換えていません。直すのは書いた人です。\n",
    );
    assert.throws(() => screenOf("$ npx chaffjs a.md", "chaff: no such file", ["a.md"], "s.md"), /s\.md: chaff's report has no header for a\.md/u);
  });
});
