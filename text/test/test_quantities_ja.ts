import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { countedAfter, dates, quantities } from "../packages/lang-ja/src/quantities.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import type { StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

const patterns = (): StructurePatterns => {
  if (ja.structure === undefined) throw new Error("lang-ja has no structure");
  return ja.structure;
};

const lines = (...rows: string[]): string => rows.join("\n");

// 形態素で読む数量と日付。このファイルは解析器を読み込んでから試す（表の経路は test_tree_ja.ts が試す）。

type Attr = number | string | undefined;

const quantityOf = (text: string): [Attr, Attr][] => quantities(text).map((mention) => [mention.attrs["value"], mention.attrs["unit"]]);

const dateOf = (text: string): Attr[] => dates(text).map((mention) => mention.attrs["value"]);

before(async () => prepare());

describe("数量（助数詞を品詞で読む）", () => {
  const cases: readonly (readonly [string, readonly (readonly [number, string])[]])[] = [
    ["検収後30日以内に支払う。", [[30, "日"]]],
    [
      "1日8時間、1週40時間とする。",
      [
        [1, "日"],
        [8, "時間"],
        [1, "週"],
        [40, "時間"],
      ],
    ],
    ["休憩時間は60分とする。", [[60, "分"]]],
    ["所定労働日の8割以上出勤した者", [[8, "割"]]],
    ["6か月間継続勤務した者", [[6, "か月"]]],
    ["委託料として金50万円を支払う。", [[500000, "円"]]],
    ["百万円以下の罰金に処する。", [[1000000, "円"]]],
    ["約1万件の契約書を用いた。", [[10000, "件"]]],
    // 数と桁の語のあいだの空白 1 つは、同じ数の一部（手元の記事「26.7 万行」）。空白 2 つや、桁でない語の前では繋がない。
    [
      "26.7 万行を 0.1 秒台で読む。",
      [
        [267000, "行"],
        [0.1, "秒"],
      ],
    ],
    ["見積は 1.2 万円です。", [[12000, "円"]]],
    ["予算は 3 億円。", [[300000000, "円"]]],
    [
      "3 人と 5 人。",
      [
        [3, "人"],
        [5, "人"],
      ],
    ],
    ["3件万一の場合。", [[3, "件"]]],
    ["精度は95.2%に向上した。", [[95.2, "%"]]],
    ["処理時間を0.5倍に短縮した。", [[0.5, "倍"]]],
    ["全角の３０日でも読む。", [[30, "日"]]],
    ["空白を挟んだ 1.5 倍も数量として読む。", [[1.5, "倍"]]],
    ["全角空白を挟んだ 1.5\u3000倍も読む。", [[1.5, "倍"]]],
    ["タブを挟んだ 30\t日も読む。", [[30, "日"]]],
    ["一年以下の懲役", [[1, "年"]]],
    ["十二人で分担した。", [[12, "人"]]],
    ["前二年の間に", [[2, "年"]]],
    ["本規程は十二条で構成する。", [[12, "条"]]],
    ["議題は三項あります。", [[3, "項"]]],
  ];
  cases.forEach(([text, expected]) => {
    it(text, () => assert.deepEqual(quantityOf(text), expected));
  });
});

describe("数量ではないもの", () => {
  const cases: readonly string[] = ["第3条に定める業務", "第十条の規定", "数字の無い文。", "3つ目の案", "第一印象は大切だ。", "文字の 3 と 4 を並べる。"];
  cases.forEach((text) => {
    it(text, () => assert.deepEqual(quantityOf(text), []));
  });
});

describe("日付（年・月・日をまとめる）", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["2024年4月1日から2025年3月31日まで", ["2024-04-01", "2025-03-31"]],
    ["2024年4月に開始する。", ["2024-04"]],
    ["12月29日から1月3日まで", ["12-29", "01-03"]],
    ["2023年に公開した。", ["2023"]],
    ["２０２４年４月１日", ["2024-04-01"]],
  ];
  cases.forEach(([text, expected]) => {
    it(text, () => assert.deepEqual(dateOf(text), expected));
  });

  it("日付にした年月日は、数量として二重に数えない", () => {
    assert.deepEqual(quantityOf("2024年4月1日から30日間"), [[30, "日間"]]);
  });

  it("1000 より小さい年は期間として数量に残す", () => {
    assert.deepEqual(dateOf("3年間有効とする。"), []);
    assert.deepEqual(quantityOf("3年で満了する。"), [[3, "年"]]);
  });

  it("年と月のあいだに別の語があれば一つの日付にしない", () => {
    assert.deepEqual(dateOf("2024年の4月1日"), ["2024", "04-01"]);
  });
});

describe("countedAfter（通し番号か数量か）", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["1.5", "倍になった。", true],
    ["2.5", "日かかる。", true],
    ["3.2", "%の増加", true],
    ["4.2", "設定", false],
    ["1.1", "目的", false],
    ["2.1", "注文の登録", false],
  ];
  cases.forEach(([number, rest, expected]) => {
    it(`${number} ${rest} → ${String(expected)}`, () => assert.equal(countedAfter(number, rest), expected));
  });
});

describe("文書の種類（profile）が決める番地の中の数は、数量ではない", () => {
  const statute = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];

  const quantitiesIn = (source: string, profile: typeof statute): string[] => {
    const collect = (node: StructureNode): string[] => [
      ...(node.kind === "quantity" ? [`${String(node.attrs["value"])}${String(node.attrs["unit"])}`] : []),
      ...node.children.flatMap(collect),
    ];
    return collect(buildStructure({ path: "c.txt", source, language: "ja", markdown: false, profile }, patterns()));
  };

  it("法令では「前二項」「前三条」は番地で、数量ではない。「前二年」は数量", () => {
    // 労働基準法 第二十二条第三項。
    const source = lines("第二十二条　前二項の証明書には、前三条の規定により前二年の分を記入する。");
    assert.deepEqual(quantitiesIn(source, statute), ["2年"]);
  });

  it("番地の後ろに語が続けば番地ではなく、数量のまま", () => {
    assert.deepEqual(quantitiesIn(lines("第二十二条　前二項中央銀行について定める。"), statute), ["2項"]);
    assert.deepEqual(quantitiesIn(lines("第二十二条　前二項目標管理制度導入を進める。"), statute), ["2項"]);
  });

  it("種類を選ばなければ、「前二項」も数量として読む", () => {
    assert.deepEqual(quantitiesIn(lines("第二十二条　前二項の証明書には、記入してはならない。"), undefined), ["2項"]);
  });

  it("番地と数量がちょうど重なれば、数量ではない（種類の中身はコードに無い）", () => {
    const toy = { id: "toy", addresses: ["三十日"], connectives: [] };
    assert.deepEqual(quantitiesIn(lines("第二十条　少くとも三十日前にその予告をしなければならない。"), toy), []);
  });

  it("番地の外にある数量は、法令でも数量", () => {
    assert.deepEqual(quantitiesIn(lines("第二十条　少くとも三十日前にその予告をしなければならない。"), statute), ["30日"]);
  });
});
