import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { markdownFigures, textFigures, type MarkdownNode } from "../packages/chaff/src/text-figures.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { StructureNode } from "../packages/chaff/src/plugin.ts";

// テキストの文書の図（線と矢印で描いた図、桁をそろえた状態の表）。文ではないので、コードブロックと同じく覆う。例文はすべて自作。

const lines = (...rows: string[]): string => rows.join("\n");

const figureTexts = (source: string): string[] => textFigures(source).map((span) => source.slice(span.start, span.end));

/** 行ごとに番号を振り、行の間に空行を置いた、二者のやり取りの図。本文と同じ 3 字の字下げで、Markdown では番号付きの箇条書きに見える。 */
const EXCHANGE = lines(
  "   The exchange below shows both sides.",
  "",
  "       Node A                                 Node B",
  "",
  "   1.  CLOSED                                 CLOSED",
  "",
  "   2.  WAITING    --> <ID=7><KIND=HELLO>      ...",
  "",
  "   3.  OPEN       <-- <ID=9><KIND=REPLY>      <-- WAITING",
  "",
  "   4.  OPEN                                   OPEN",
  "",
  "   Figure 1: A greeting between two nodes",
  "",
  "   After the greeting, both nodes are ready.",
);

/** 枠と矢印の図。本文と同じ字下げの行が混ざるので、Markdown のインデントのコードブロックにならない。 */
const BOXES = lines(
  "   The states are drawn below.",
  "",
  "          +---------+        start",
  "          |  IDLE   |-------------------+",
  "          +---------+                   |",
  "               ^                        V",
  "   +---------+ |                  +---------+",
  "   |  DONE   |-+                  |  BUSY   |",
  "   +---------+ <------------------+---------+",
  "",
  "   Each state is described in turn.",
);

describe("textFigures: 図の塊", () => {
  it("空行を挟んで続く、矢印や桁そろえの行の塊を 1 つの図とする。見出しの行も入り、説明の文と図の題は入らない", () => {
    assert.deepEqual(figureTexts(EXCHANGE), [
      lines(
        "       Node A                                 Node B",
        "",
        "   1.  CLOSED                                 CLOSED",
        "",
        "   2.  WAITING    --> <ID=7><KIND=HELLO>      ...",
        "",
        "   3.  OPEN       <-- <ID=9><KIND=REPLY>      <-- WAITING",
        "",
        "   4.  OPEN                                   OPEN",
      ),
    ]);
  });

  it("枠と矢印だけの図は、字下げが浅い行も含めて 1 つの図", () => {
    const [figure] = figureTexts(BOXES);
    assert.ok(figure !== undefined);
    assert.match(figure, /^ {10}\+-{9}\+/u);
    assert.match(figure, /\+-{9}\+$/u);
    assert.equal(figureTexts(BOXES).length, 1);
  });

  it("枠の文字（U+2500 台の罫線）も線として数える", () => {
    const boxed = lines("   ┌──────┐     ┌──────┐", "   │ IDLE │ ──▶ │ BUSY │", "   └──────┘     └──────┘");
    assert.deepEqual(figureTexts(boxed), [boxed]);
  });

  it("桁をそろえただけで線の無い表は図にしない（語の表は本文として読む）", () => {
    const table = lines("   Name        Owner        Status", "   alpha       Lee          open", "   beta        Kim          closed");
    assert.deepEqual(figureTexts(table), []);
  });

  it("線のある表でも、文が入った行は本文。文の行で塊が切れ、残りが 1 行なら図にしない", () => {
    const table = lines(
      "   Name        Meaning",
      "   +-----------+------------------+",
      "   alpha       Sends the request. It waits for the reply.",
      "   beta        Closes the link, then frees the buffer.",
    );
    assert.deepEqual(figureTexts(table), [lines("   Name        Meaning", "   +-----------+------------------+")]);
    const endings = lines("   Name        Meaning", "   +-----------+------------------+", "   alpha       Sends requests.", "   beta        Closes links.");
    assert.deepEqual(figureTexts(endings), [lines("   Name        Meaning", "   +-----------+------------------+")]);
    const notes = lines("   1.  OPEN     --> <ID=1>      --> (back to IDLE!)", "", "   2.  IDLE                         IDLE");
    assert.deepEqual(figureTexts(notes), [notes]);
    const prose = lines("   Right arrows (-->) mark a message sent to the peer.  Left", "   arrows (<--) mark the reverse.  Both are shown below.");
    assert.deepEqual(figureTexts(prose), []);
  });

  it("矢印が 1 行だけの文や、区切りの線 1 行は図にしない", () => {
    assert.deepEqual(figureTexts(lines("   The arrow (-->) marks a message sent", "   to the other side of the link")), []);
    assert.deepEqual(figureTexts(lines("Title", "=====", "", "Body text follows here.")), []);
    assert.deepEqual(figureTexts(lines("Before", "", "   ----------", "", "", "   +--------+", "", "After")), []);
  });

  it("空行が 2 行続くと別の塊", () => {
    const apart = lines("   +----+", "   | A  |", "", "", "   Some text here", "", "", "   +----+  +--+", "   |  B |  |C |");
    assert.deepEqual(figureTexts(apart), [lines("   +----+", "   | A  |"), lines("   +----+  +--+", "   |  B |  |C |")]);
  });

  it("句読点の無い行（「(Close)」）は、図の行に挟まれていれば図に入る。塊の端にあれば入らない", () => {
    const closing = lines(
      "       Node A                                 Node B",
      "",
      "   1.  OPEN                                   OPEN",
      "",
      "   2.  (Close)",
      "       WAIT-1     --> <ID=1><KIND=FIN>        --> WAIT-2",
      "",
      "   3.  (2 ticks)",
      "       CLOSED",
    );
    assert.deepEqual(figureTexts(closing), [closing.slice(0, closing.indexOf("\n\n   3."))]);
    const edges = lines("   the link stays up until the peer", "", "   +----+   +----+", "   | A  |-->| B  |", "", "   and then the link goes down");
    assert.deepEqual(figureTexts(edges), [lines("   +----+   +----+", "   | A  |-->| B  |")]);
  });

  it("区切りの線（----- や =====）は図の印にならない。題を挟んでも、語の表の下線でも図ではない。図の中にはあってよい", () => {
    assert.deepEqual(figureTexts(lines("   ==========", "   Section 5 Fees", "   ==========")), []);
    assert.deepEqual(figureTexts(lines("---", "", "5. Fees", "", "---")), []);
    assert.deepEqual(figureTexts(lines("   Name      Owner", "   ----      -----", "   alpha     Lee")), []);
    const framed = lines("   +------+", "   | IDLE |", "   --------", "   | BUSY |", "   +------+");
    assert.deepEqual(figureTexts(framed), [framed]);
  });

  it("箇条書きの印の後ろの空白は桁そろえではない（「-   Infra hiring …」）", () => {
    const items = lines(
      "-   Infra hiring in Q1 will bring the budget back to",
      "    near baseline",
      "-   No decision on the admin post has been made yet",
      "",
      "Hiring",
      "======",
    );
    assert.deepEqual(figureTexts(items), []);
    assert.deepEqual(figureTexts(lines("1.  first item text", "2.  second item text", "    -->")), []);
  });

  it("箇条書きの印 1 つ（「- EU」「- GP」）は線ではない", () => {
    assert.deepEqual(figureTexts(lines("- EU", "- GP", "- ID")), []);
    assert.deepEqual(figureTexts(lines("+ a", "+ b")), []);
  });

  it("skip の中で始まる行は図の行に数えない（Markdown のコード・表）", () => {
    const table = lines("Version   | Date", "---       | ---", "3.1.0     | 2021-02-15", "3.0.3     | 2020-02-20");
    assert.equal(figureTexts(table).length, 1);
    assert.deepEqual(textFigures(table, [{ start: 0, end: table.length }]), []);
    assert.deepEqual(
      figureTexts(table).length,
      textFigures(table, [
        { start: 0, end: 3 },
        { start: 1, end: 10 },
      ]).length,
    );
    assert.deepEqual(
      textFigures(table, [
        { start: 20, end: 25 },
        { start: 0, end: 18 },
      ]),
      [],
    );
  });

  it("語のあいだのダッシュ（---）、見出しの印（== … ==）、パンくずの「- /」は線ではない", () => {
    assert.deepEqual(figureTexts(lines("- 47.041 --- Engineering", "- 47.049 --- Mathematical Sciences", "- 47.050 --- Geosciences")), []);
    assert.deepEqual(figureTexts(lines("== Community ==", "", "Last committer: 2018 (Lee)", "", "== Community Objectives ==")), []);
    assert.deepEqual(figureTexts(lines("- /", "- Journal of Health", "-  /", "- 74 (2025) 1")), []);
  });

  it("図と図のあいだの、句読点の無い折り返した文の行は図に入らない", () => {
    const between = lines(
      "   +------+------+",
      "   | Name | Kind |",
      "   +------+------+",
      "",
      "   The following diagrams may help to relate some of these variables to",
      "   the sequence space",
      "",
      "        1          2",
      "   ----------|----------",
    );
    assert.deepEqual(figureTexts(between), [
      lines("   +------+------+", "   | Name | Kind |", "   +------+------+"),
      lines("        1          2", "   ----------|----------"),
    ]);
  });

  it("線の文字が半分に届かない行は線ではない（「== Community ==」が 2 行あっても図にしない）", () => {
    assert.deepEqual(figureTexts(lines("== Community ==", "", "== Releases ==")), []);
  });

  it("語のあいだの 2 字の空白は桁そろえではない（文のあいだの空白）", () => {
    assert.deepEqual(figureTexts(lines("   +------+", "   the link  goes down")), []);
  });

  it("箇条書きの印の後ろの空白で桁そろえの行にしない（線の行が続いても図にしない）", () => {
    assert.deepEqual(figureTexts(lines("-   first item text", "-   second item text", "    +--->")), []);
  });

  it("一文字で立つ v は下向きの矢印。語の中の v は数えない", () => {
    const arrows = lines("   start       stop", "     v           v");
    assert.deepEqual(figureTexts(arrows), [arrows]);
    assert.deepEqual(figureTexts(lines("   vivid       vows", "   save        view")), []);
  });

  it("罫線の文字は、続いていても（──▶）、離れていても（│ a │）線", () => {
    const run = lines("   node ──▶ next hop over here", "   IDLE        BUSY");
    assert.deepEqual(figureTexts(run), [run]);
    const apart = lines("   │ a │ b │", "   │ c │ d │");
    assert.deepEqual(figureTexts(apart), [apart]);
  });

  it("日本語の文（句点・読点のある行）は図にしない。全角の空白は桁そろえに数えない", () => {
    assert.deepEqual(figureTexts(lines("   状態　　　　　　意味", "   待機 --> 応答、送信を終える。", "   終了 <-- 回線を閉じる。")), []);
  });

  it("空・空行だけ・1 行だけの入力は何も無い", () => {
    assert.deepEqual(textFigures(""), []);
    assert.deepEqual(textFigures("\n\n\n"), []);
    assert.deepEqual(textFigures("   +--------+--------+"), []);
  });
});

describe("markdownFigures: Markdown の塊の外だけ", () => {
  const node = (type: string, start: number, end: number): MarkdownNode => ({ type, position: { start: { offset: start }, end: { offset: end } } });

  it("見出し・表・コード・HTML の行は図の行に数えない", () => {
    const source = lines("## Flow A --> B", "   +----+   +----+");
    const heading = node("heading", 0, source.indexOf("\n"));
    assert.deepEqual(markdownFigures({ type: "root", children: [heading] }, source), []);
    assert.deepEqual(markdownFigures({ type: "root", children: [] }, source), [{ start: 0, end: source.length }]);
    ["table", "code", "html"].forEach((type) => assert.deepEqual(markdownFigures({ type: "root", children: [node(type, 0, 5)] }, source), [], type));
    assert.deepEqual(markdownFigures({ type: "root", children: [node("paragraph", 0, 5)] }, source).length, 1);
  });
});

describe("図は本文として読まない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const sentencesOf = (path: string, source: string): string[] => buildDocument(path, source, en).sentences.map((sentence) => sentence.text.trim());

  it(".txt: 図の行は文に入らず、図の前後の文は残る。位置は元の文字列のまま", () => {
    const doc = buildDocument("rfc.txt", EXCHANGE, en);
    const joined = sentencesOf("rfc.txt", EXCHANGE).join(" | ");
    assert.doesNotMatch(joined, /CLOSED|WAITING|Node B|KIND=|OPEN/u);
    assert.match(joined, /The exchange below shows both sides\./u);
    assert.match(joined, /After the greeting, both nodes are ready\./u);
    assert.equal(doc.prose?.length, EXCHANGE.length);
    const after = doc.sentences.find((sentence) => sentence.text.includes("After the greeting"));
    assert.equal(after?.span.start, EXCHANGE.indexOf("After the greeting"));
  });

  it("Markdown でも、コードブロックの外の図は本文として読まない。フェンスの中はもともとコード", () => {
    assert.doesNotMatch(sentencesOf("rfc.md", EXCHANGE).join(" | "), /CLOSED|WAITING/u);
    assert.doesNotMatch(sentencesOf("rfc.md", BOXES).join(" | "), /IDLE|BUSY/u);
    const fenced = lines("Intro text here.", "", "```", "+---+   +---+", "| A |-->| B |", "+---+   +---+", "```", "", "Outro text here.");
    assert.deepEqual(sentencesOf("f.md", fenced), ["Intro text here.", "Outro text here."]);
  });

  it("Markdown の表（| の区切り）は表のまま。木は表の中の参照を読む", () => {
    const source = lines(
      "# Terms",
      "",
      "## Section 1 Scope",
      "",
      "Item      | Rule",
      "---       | ---",
      "fees      | see Section 7",
      "refunds   | see Section 1",
      "",
    );
    const findings = runRules(buildDocument("c.md", source, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "dangling-reference",
    );
    assert.deepEqual(
      findings.map((finding) => finding.values["target"]),
      ["7"],
    );
  });

  it("Markdown の区切りの線に挟まれた見出しは、見出しのまま（番号の抜けにならない）", () => {
    const source = lines("# Spec", "", "## 1. Scope", "", "text", "", "---", "", "## 2. Terms", "", "---", "", "## 3. Fees", "", "text", "");
    const findings = runRules(buildDocument("s.md", source, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "numbering-gap",
    );
    assert.deepEqual(findings, []);
  });

  it("Markdown の本文の --- や表の区切りを図と読まない", () => {
    const source = lines("The plan --- as agreed --- starts today.", "The team -- all of it -- agrees.");
    assert.deepEqual(sentencesOf("p.md", source), ["The plan --- as agreed --- starts today.", "The team -- all of it -- agrees."]);
  });

  it("doubled-word: 図の中の「CLOSED CLOSED」「OPEN OPEN」を重なりとしない", () => {
    const findings = runRules(buildDocument("rfc.txt", EXCHANGE, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "doubled-word",
    );
    assert.deepEqual(findings, []);
  });

  it("図が無ければ、テキストの文書の文は変わらない（語の表は本文のまま）", () => {
    const table = lines("   Name        Owner        Status", "   alpha       Lee          open");
    assert.match(sentencesOf("t.txt", table).join(" | "), /alpha/u);
  });

  it("日本語の文書でも、図の行は文に入らない", async () => {
    await ja.prepare?.({ pos: true });
    const source = lines("図を示す。", "", "   +------+      +------+", "   | 待機 |----->| 応答 |", "   +------+      +------+", "", "以上である。");
    const joined = buildDocument("z.txt", source, ja)
      .sentences.map((sentence) => sentence.text.trim())
      .join(" | ");
    assert.doesNotMatch(joined, /待機|応答/u);
    assert.match(joined, /図を示す。/u);
  });
});

describe("木も図を読まない", () => {
  const FIGURED = lines(
    "Section 1 Scope",
    "See Section 2.",
    "",
    "   +-----------+       +-----------+",
    "   | Section 9 |------>| Section 8 |",
    "   +-----------+       +-----------+",
    "",
    "Section 2 Terms",
    "text",
  );

  it("図の中の「Section 9」は参照にならない（dangling-reference を出さない）", () => {
    const findings = runRules(buildDocument("c.txt", FIGURED, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "dangling-reference",
    );
    assert.deepEqual(findings, []);
  });

  it("Markdown でも、コードブロックの外の図の中の「Section 9」は参照にならない", () => {
    const source = lines(
      "# Terms",
      "",
      "## Section 1 Scope",
      "",
      "See Section 2.",
      "",
      "+-----------+     +-----------+",
      "| Section 9 |---->| Section 8 |",
      "+-----------+     +-----------+",
      "",
      "## Section 2 Terms",
      "",
      "text",
      "",
    );
    const findings = runRules(buildDocument("c.md", source, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "dangling-reference",
    );
    assert.deepEqual(findings, []);
  });

  it("chaff tree の入口（buildStructure）でも、図の中の番号は節にならない", () => {
    const addresses = (node: StructureNode): string[] => [...(node.address === "" ? [] : [node.address]), ...node.children.flatMap(addresses)];
    const source = lines("Section 1 Scope", "text", "", "   +-----------+", "   Section 9   |", "   +-----------+", "", "Section 2 Terms", "text");
    const tree = buildStructure({ path: "c.txt", source, language: "en", markdown: false }, en.structure ?? assert.fail("lang-en has no structure"));
    assert.deepEqual(addresses(tree), ["1", "2"]);
  });
});
