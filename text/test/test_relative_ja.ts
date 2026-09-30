import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { relativeMentions } from "../packages/chaff/src/structure/relative-find.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { danglingReferences } from "../packages/chaff/src/structure/issues.ts";
import type { DocumentProfile, StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

// 前条・前項・同条・第一項のような相対の参照。語は profiles/statute.yaml が持ち、core が木の中の場所から番地を決める。

const patterns = (): StructurePatterns => {
  if (ja.structure === undefined) throw new Error("lang-ja has no structure");
  return ja.structure;
};

const statute = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];
if (statute === undefined) throw new Error("profiles/statute.yaml has no ja section");

const lines = (...rows: string[]): string => rows.join("\n");

const found = (text: string): string[] =>
  relativeMentions(text, statute, patterns().number, patterns().references(text)).map(
    (mention) => `${String(mention.attrs["label"])}:${String(mention.attrs["relative"])}`,
  );

const treeWith = (source: string, profile: DocumentProfile | undefined): StructureNode =>
  buildStructure({ path: "c.txt", source, language: "ja", markdown: false, profile }, patterns());

const treeOf = (source: string): StructureNode => treeWith(source, statute);

const describeReference = (node: StructureNode): string => {
  const document = node.attrs["document"] === undefined ? "" : `@${String(node.attrs["document"])}`;
  return `${String(node.attrs["label"])}→${String(node.attrs["target"])}${document}`;
};

const references = (node: StructureNode): string[] => [...(node.kind === "reference" ? [describeReference(node)] : []), ...node.children.flatMap(references)];

describe("relativeMentions — 見つけ方", () => {
  it("前・次・同・本と、各・数・番地の続き", () => {
    assert.deepEqual(found("前条、次項、同号、本条、前各項、前二項及び前条第二項の規定"), [
      "前条:before",
      "次項:after",
      "同号:same",
      "本条:current",
      "前各項:before",
      "前二項:before",
      "前条第二項:before",
    ]);
  });

  it("語の一部（事前条件）と、後ろに漢字が続くもの（前条件）は参照ではない", () => {
    assert.deepEqual(found("事前条件を満たす"), []);
    assert.deepEqual(found("前条件を満たす"), []);
  });

  it("後ろにつなぎの語（各号・本文）が続いてもよい", () => {
    assert.deepEqual(found("前項各号に掲げる"), ["前項:before"]);
    assert.deepEqual(found("前項本文の場合"), ["前項:before"]);
  });

  it("読み替えの括弧の中は読まない（閉じの後ろにも、開きの前にも目印がある）", () => {
    assert.deepEqual(found("同項中「前条」とあるのは「次条」と読み替える"), ["同項:same"]);
    assert.deepEqual(found("同条第二項中「前条」とあるのは、「前条第四項第二号」と読み替える"), ["同条第二項:same"]);
  });

  it("条を書かない番地は、並びの続きか、今いるところの中", () => {
    // 会社法第三十条第二項、第三百五十条。
    assert.deepEqual(found("第三十三条第七項若しくは第九項"), ["第九項:continue"]);
    assert.deepEqual(found("第一項の規定にかかわらず、同項第二号に掲げる場合"), ["第一項:current", "同項第二号:same"]);
  });

  it("号の下の「ハ」、枝番号の「の二」、つなぎの語も並びをつなぐ", () => {
    assert.deepEqual(found("第百三十八条第一号ハ又は第二号ハの請求"), ["第二号:continue"]);
    assert.deepEqual(found("第百九十七条第一項第一号から第四号の二まで、第五号若しくは第六号"), ["第四号:continue", "第五号:continue", "第六号:continue"]);
    assert.deepEqual(found("第二十七条第一項各号又は第五項各号"), ["第五項:continue"]);
  });

  it("括弧書きを挟んでも、同じ深さの参照の続き。参照の直後の括弧書きの中は、その参照の中", () => {
    assert.deepEqual(found("第三百二十五条の三第一項（第五号及び第六号に係る部分に限る。）及び第三項"), [
      "第五号:continue",
      "第六号:continue",
      "第三項:continue",
    ]);
    assert.deepEqual(found("第二十七条（第四項を除き、第五項及び第六項の規定を"), ["第四項:continue", "第五項:continue", "第六項:continue"]);
  });

  it("語に続く番地（別表第一第一号）と、その続きは読まない", () => {
    assert.deepEqual(found("別表第一第一号から第三号まで、第六号及び第七号に掲げる事業"), []);
  });

  it("種類を選ばなければ、何も読まない", () => {
    assert.deepEqual(relativeMentions("前条の規定", undefined, patterns().number), []);
  });
});

// 労働基準法 第二十条〜第二十二条（公共の著作物）を短くしたもの。
const LABOR = lines(
  "第二十条　使用者は、予告をしなければならない。",
  "２　前項の予告の日数は、短縮することができる。",
  "３　前条第二項の規定は、第一項但書の場合にこれを準用する。",
  "第二十一条　前条の規定は、次の各号の一に該当する労働者については適用しない。",
  "一　日日雇い入れられる者",
  "二　前号に該当しない者",
  "第二十二条　労働者が請求した場合においては、交付しなければならない。",
  "２　労働者が請求した場合においては、交付しなければならない。",
  "３　前二項の証明書には、記入してはならない。",
  "４　前各項の規定は、次条の場合に準用する。",
);

describe("resolveRelative — 木の中の場所から番地を決める", () => {
  it("前項は同じ条の前の項。第 2 項の前項は番号の無い第 1 項（条そのもの）", () => {
    assert.deepEqual(references(treeOf(LABOR)).slice(0, 1), ["前項→20.1"]);
  });

  it("前項は二つ前が無ければ決められない。第 2 項の前二項は読まない", () => {
    const source = lines("第一条　本文。", "２　前二項の規定による。", "第二条　本文。", "第三条　本文。");
    assert.deepEqual(references(treeOf(source)), []);
  });

  it("前条・前号・前二項・前各項", () => {
    const found = references(treeOf(LABOR));
    assert.ok(found.includes("前条→20"));
    assert.ok(found.includes("前号→21.1.1"));
    assert.ok(found.includes("前二項→22.1"), found.join(" "));
    assert.ok(found.includes("前各項→22.1"), found.join(" "));
  });

  it("前条第二項は前の条の第 2 項。条を書かない第一項は、書いた条の第 1 項", () => {
    const found = references(treeOf(LABOR));
    // 第二十条は最初の条なので、その中の「前条第二項」は決められず、読まない。
    assert.ok(!found.some((entry) => entry.startsWith("前条第二項")), found.join(" "));
    assert.ok(found.includes("第一項→20.1"), found.join(" "));
  });

  it("次条は後ろの条。最後の条の次条は決められないので読まない", () => {
    const found = references(treeOf(LABOR));
    assert.ok(!found.some((entry) => entry.startsWith("次条")), found.join(" "));
    const withNext = references(treeOf(lines("第一条　次条の規定による。", "第二条　本文。", "第三条　本文。")));
    assert.deepEqual(withNext, ["次条→2"]);
  });

  it("最初の条の前条も決められないので読まない", () => {
    assert.deepEqual(references(treeOf(lines("第一条　前条の規定による。", "第二条　本文。", "第三条　本文。"))), []);
  });

  it("同条は最後に名指しされた条。前項・第一項は条を名指ししないので、同条の行き先を変えない", () => {
    // 会社法第百五十九条第二項。
    const source = lines(
      "第百五十七条　本文。",
      "第百五十八条　本文。",
      "第百五十九条　本文。",
      "２　第百五十七条第一項第四号の期日において、前項の株主が申込みをした数が同条第一項第一号の数を超える。",
    );
    assert.ok(references(treeOf(source)).includes("同条第一項第一号→157.1.1"), references(treeOf(source)).join(" "));
  });

  it("他の文書の条を引いた後の同条は、その文書のもの", () => {
    const source = lines("第一条　民法第七百九条の規定は、同条第二項の場合に準用する。", "第二条　本文。", "第三条　本文。");
    assert.deepEqual(references(treeOf(source)), ["第七百九条→709@民法", "同条第二項→709.2@民法"]);
  });

  it("並びの続きは、元の参照の番地の続き", () => {
    const source = lines("第一条　第三条第一項若しくは第二項の規定による。", "第二条　本文。", "第三条　本文。", "２　本文。");
    assert.deepEqual(references(treeOf(source)), ["第三条第一項→3.1", "第二項→3.2"]);
  });

  it("種類を選ばなければ、前条は参照にならない", () => {
    assert.deepEqual(references(treeWith(LABOR, undefined)), []);
  });
});

describe("resolveRelative — 章・番号付きの項・号", () => {
  it("条は文書を通して並ぶので、章をまたいでも前条は前の条", () => {
    const source = lines("第一章　総則", "第一条　本文。", "第二章　雑則", "第二条　前条の規定による。", "第三条　本文。");
    assert.deepEqual(references(treeOf(source)), ["前条→1"]);
  });

  it("項に第 1 項から番号を振る書き方では、番号の無い第 1 項を足さない", () => {
    const source = lines("第1条（目的）", "第1項　本文。", "第2項　前二項の規定による。", "第2条（定義）", "第3条（支払）");
    assert.deepEqual(references(treeOf(source)), []);
  });

  it("前条第二号は、前の条の番号の無い第 1 項の号", () => {
    const source = lines("第一条　次に掲げる者", "一　本文", "二　本文", "第二条　前条第二号に掲げる者", "第三条　本文。");
    assert.deepEqual(references(treeOf(source)), ["前条第二号→1.1.2"]);
  });
});

describe("resolveRelative — 章、範囲の行、Markdown", () => {
  it("前章は同条の行き先を変えない。同章は読まない", () => {
    const source = lines("第一章　総則", "第一条　本文。", "第二章　雑則", "第二条　前章の規定による。同章の規定による。同条の規定による。", "第三条　本文。");
    assert.deepEqual(references(treeOf(source)), ["前章→ch1"]);
  });

  it("前に数えて範囲の行（第四十三条から第五十五条まで 削除）に当たれば決めない", () => {
    const source = lines("第四十二条　本文。", "第四十三条から第五十五条まで　削除", "第五十六条　前条の規定による。", "第五十七条　前条の規定による。");
    assert.deepEqual(references(treeOf(source)), ["前条→56"]);
  });

  it("範囲の行をまたいで数えれば決めない。後ろに数えて範囲に当たるのは、その最初の条", () => {
    const source = lines(
      "第四十一条　次二条の規定による。",
      "第四十二条　次二条の規定による。",
      "第四十三条から第五十五条まで　削除",
      "第五十六条　前二条の規定による。",
      "第五十七条　本文。",
    );
    assert.deepEqual(references(treeOf(source)), ["次二条→43"]);
  });

  it("Markdown の見出しで分けても、同じ条の前の項を読む", () => {
    const source = lines("## 第一条", "本文。", "### 払い方", "２　本文。", "### 期限", "３　前項の規定による。", "## 第二条", "本文。", "## 第三条", "本文。");
    const tree = buildStructure({ path: "c.md", source, language: "ja", markdown: true, profile: statute }, patterns());
    assert.deepEqual(references(tree), ["前項→1.2"]);
  });
});

describe("dangling-reference が相対の参照も確かめる", () => {
  it("前条第五項の条に第 5 項が無ければ指摘する", () => {
    const source = lines("第一条　本文。", "２　本文。", "第二条　前条第五項の規定による。", "第三条　本文。");
    assert.deepEqual(
      danglingReferences(treeOf(source), source).map((issue) => issue.values["target"]),
      ["1.5"],
    );
  });

  it("前条第二項の条に第 2 項があれば指摘しない", () => {
    const source = lines("第一条　本文。", "２　本文。", "第二条　前条第二項の規定による。", "第三条　本文。");
    assert.deepEqual(danglingReferences(treeOf(source), source), []);
  });
});

describe("同項・同号・同条は、前の参照が指した文書のもの", () => {
  // 見出しに「1 目的」と番号を振った指針。「法第16条」は条で数える別の文書（法律）の条で、この指針の 16 ではない。
  const GUIDELINE = lines(
    "## 1　目的",
    "",
    "本文。",
    "",
    "## 2　定義",
    "",
    "- ２　法第16条第1項第2号の政令で定めるものは、同項に規定する情報の集合物をいう。",
    "- ３　法第27条第5項第3号の規定による通知は、同号に規定する方法による。",
    "- ４　法第182条の罰金刑は、同条の規定による。",
    "",
    "## 3　適用",
    "",
    "- １　法第十六条の規定は、同条第二項の場合に準用する。同項各号に掲げる事項とする。",
    "- ２　法第二十九条第一項若しくは第三項の記録は、同項の規定による。",
    "- ３　法第三十条の規定は、同条第一項若しくは第二項の場合による。",
  );
  const guidelineTree = (): StructureNode => buildStructure({ path: "g.md", source: GUIDELINE, language: "ja", markdown: true, profile: statute }, patterns());
  const dangling = (tree: StructureNode, source: string): string[] =>
    danglingReferences(tree, source).map((issue) => `${String(issue.values["label"])}:${String(issue.values["target"])}`);

  it("別の文書の条を引いた後の同項・同号・同条は、この文書で引かない", () => {
    assert.deepEqual(dangling(guidelineTree(), GUIDELINE), []);
  });

  it("同を重ねても、並びの続きの後でも、元の参照の文書のまま", () => {
    const labelled = (node: StructureNode): string[] => [
      ...(node.kind === "reference" ? [`${String(node.attrs["label"])}:${String(node.attrs["unitWord"] ?? "-")}`] : []),
      ...node.children.flatMap(labelled),
    ];
    assert.deepEqual(labelled(guidelineTree()).slice(-10), [
      "同条:条",
      "第十六条:条",
      "同条第二項:条",
      "同項:条",
      "第二十九条第一項:条",
      "第三項:条",
      "同項:条",
      "第三十条:条",
      "同条第一項:条",
      "第二項:条",
    ]);
  });

  it("この法令の条を引いた後の同項は、この法令の中で引く。あれば指摘しない", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "第三条　本文。", "２　本文。", "第四条　第三条第二項の規定は、同項の場合に準用する。");
    assert.deepEqual(references(treeOf(source)), ["第三条第二項→3.2", "同項→3.2"]);
    assert.deepEqual(danglingReferences(treeOf(source), source), []);
  });

  it("この法令の条を引いた後の同項は、無ければ指摘する", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "第三条　本文。", "第四条　第三条第二項の規定は、同項の場合に準用する。");
    assert.deepEqual(dangling(treeOf(source), source), ["第三条第二項:3.2", "同項:3.2"]);
  });

  it("別の文書の後でも、前項の後の同項はこの法令の中。無ければ指摘する", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "２　民法第七百九条第二項の規定による。", "３　前項第九号の規定は、同項第八号の場合に準用する。");
    assert.deepEqual(dangling(treeOf(source), source), ["前項第九号:2.2.9", "同項第八号:2.2.8"]);
  });
});

describe("読み替えの括弧の中の番地は、読み替える先の文書のもの", () => {
  const SUBSTITUTED = "@（読み替えの中）";

  it("閉じの後ろか開きの前に「とあるのは」がある括弧だけ。読点を挟んでもよい", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "第三条　同項中「第九十九条」とあるのは、「第百条」とする。");
    assert.deepEqual(references(treeOf(source)), [`第九十九条→99${SUBSTITUTED}`, `第百条→100${SUBSTITUTED}`]);
  });

  it("ほかの括弧（定義した語、引用）の中の番地は、この文書の番地", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "第三条　「第一条に規定する者」をいう。");
    assert.deepEqual(references(treeOf(source)), ["第一条→1"]);
  });

  it("名指しした文書があれば、その文書のまま", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "第三条　「民法第七百九条」とあるのは「第百条」とする。");
    assert.deepEqual(references(treeOf(source)), ["第七百九条→709@民法", `第百条→100${SUBSTITUTED}`]);
  });

  it("文書の種類が無ければ、読み替えを知らない", () => {
    const source = lines("第一条　本文。", "第二条　本文。", "第三条　同項中「第九十九条」とあるのは「第百条」とする。");
    assert.deepEqual(references(treeWith(source, undefined)), ["第九十九条→99", "第百条→100"]);
  });
});
