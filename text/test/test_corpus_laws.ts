import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { structureFindings } from "../scripts/corpus-findings.ts";
import { lawText } from "../scripts/law-text.ts";

// 施行中の法令は、条・項・号の番号と参照が整っている。構造の rule が何か言えば、それは chaff の誤り。
// 法令は corpus/laws/ に置いてある（yarn corpus:fetch で取り直す。著作権法第13条により法令は自由に使える）。

const LAWS = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus", "laws");

describe("実際の法令に、構造の rule は何も言わない", () => {
  readdirSync(LAWS)
    .filter((file) => file.endsWith(".txt"))
    .forEach((file) => {
      it(file, async () => {
        const findings = await structureFindings(file, readFileSync(join(LAWS, file), "utf8"));
        assert.deepEqual(
          findings.map((finding) => `${String(finding.line)} ${finding.rule} ${finding.message}`),
          [],
        );
      });
    });
});

describe("e-Gov の法令 XML を、画面と同じ文字に直す", () => {
  const XML = [
    "<Law><LawNum>昭和二十二年法律第四十九号</LawNum><LawBody><LawTitle>労働基準法</LawTitle>",
    "<TOC><TOCChapter><ChapterTitle>第一章　総則</ChapterTitle></TOCChapter></TOC>",
    "<MainProvision><Chapter><ChapterTitle>第一章　総則</ChapterTitle>",
    "<Article><ArticleCaption>（平均賃金）</ArticleCaption><ArticleTitle>第十二条</ArticleTitle>",
    "<Paragraph><ParagraphNum/><ParagraphSentence><Sentence>この法律で平均賃金とは、</Sentence><Sentence>次の金額をいう。</Sentence></ParagraphSentence>",
    "<Item><ItemTitle>一</ItemTitle><ItemSentence><Sentence>賃金の総額</Sentence></ItemSentence></Item></Paragraph>",
    "<Paragraph><ParagraphNum/><ParagraphSentence><Sentence>前項の期間は、起算する。</Sentence></ParagraphSentence></Paragraph>",
    "<Paragraph><ParagraphNum>３</ParagraphNum><ParagraphSentence><Sentence>番号のある項。</Sentence></ParagraphSentence></Paragraph>",
    "</Article><Article><ArticleTitle>第十三条</ArticleTitle></Article></Chapter></MainProvision>",
    "<SupplProvision><Article><ArticleTitle>第一条</ArticleTitle></Article></SupplProvision></LawBody></Law>",
  ].join("");

  it("目次と附則を外し、条・項・号を一行ずつにする", () => {
    assert.equal(
      lawText(XML),
      [
        "労働基準法",
        "",
        "第一章\u3000総則",
        "",
        "（平均賃金）",
        "第十二条\u3000この法律で平均賃金とは、次の金額をいう。",
        "一\u3000賃金の総額",
        "\u3000前項の期間は、起算する。",
        "３\u3000番号のある項。",
        "",
        "第十三条",
        "",
      ].join("\n"),
    );
  });

  it("空でも落ちない", () => {
    assert.equal(lawText(""), "\n");
  });
});
