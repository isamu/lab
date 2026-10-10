import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepare, type Morph } from "../packages/lang-ja/src/pos.ts";
import { continuesWithMultiplier, countedAfter, countedByTable, dates, quantities } from "../packages/lang-ja/src/quantities.ts";
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
      "売上高は2,400百万円、受注は1,320千円。",
      [
        [2400000000, "円"],
        [1320000, "円"],
      ],
    ],
    [
      "売上高は2,400 百万円、受注は1,320 千円。",
      [
        [2400000000, "円"],
        [1320000, "円"],
      ],
    ],
    [
      "3 人と 5 人。",
      [
        [3, "人"],
        [5, "人"],
      ],
    ],
    ["3件万一の場合。", [[3, "件"]]],
    ["精度は95.2%に向上した。", [[95.2, "%"]]],
    // 解析器は半角の % と後ろの読点・括弧・句点を一語に読む（「%、」）。% だけが単位。
    [
      "小売が45%、製造が35%、物流が20%です。",
      [
        [45, "%"],
        [35, "%"],
        [20, "%"],
      ],
    ],
    [
      "比率（45%）と（35%）。",
      [
        [45, "%"],
        [35, "%"],
      ],
    ],
    ["伸びは12.5%。次は", [[12.5, "%"]]],
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

describe("品詞を読まないときの単位の表でも、空白を挟んだ桁の語は同じ数", () => {
  const read = (text: string): [number, string][] => countedByTable(text).map((item) => [item.value, item.unit]);

  it("1.2 万円は 12000 円、約 3 万件は 30000 件", () => {
    assert.deepEqual(read("見積は 1.2 万円です。"), [[12000, "円"]]);
    assert.deepEqual(read("約 3 万件の文書。"), [[30000, "件"]]);
  });

  it("空白の無い 1.2万円も 12000 円の一つだけ（前は 1.2 万円と 10000 円の二つに読んでいた）", () => {
    assert.deepEqual(read("1.2万円です。"), [[12000, "円"]]);
  });

  it("桁の語の無い書き方はこれまでどおり", () => {
    assert.deepEqual(read("3 人です。"), [[3, "人"]]);
    assert.deepEqual(read("百万円の罰金。"), [[1000000, "円"]]);
  });

  it("算用数字の後ろの百万・千（決算の表の単位）も同じ数", () => {
    assert.deepEqual(read("売上高は2,400百万円です。"), [[2400000000, "円"]]);
    assert.deepEqual(read("受注は1,320千円です。"), [[1320000, "円"]]);
    assert.deepEqual(read("受注は1,320 千円、売上は2,400 百万円です。"), [
      [1320000, "円"],
      [2400000000, "円"],
    ]);
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

  it("西暦の年の後ろに括弧で書いた元号の年は、同じ年の言い換え", () => {
    assert.deepEqual(dateOf("2026年（令和8年）9月4日"), ["2026-09-04"]);
    assert.deepEqual(dateOf("2019年(令和元年)5月1日に改元"), ["2019-05-01"]);
    assert.deepEqual(quantityOf("2026年（令和8年）9月4日"), []);
    assert.deepEqual(dateOf("2026年（令和8年）"), ["2026"]);
  });

  it("元号の年の後ろに括弧で書いた西暦の年も、同じ年の言い換え", () => {
    assert.deepEqual(dateOf("令和6年（2024年）12月17日"), ["2024-12-17"]);
    assert.deepEqual(dateOf("令和6（2024）年12月17日"), ["2024-12-17"]);
    assert.deepEqual(dateOf("令和６年（２０２４年）１２月１７日"), ["2024-12-17"]);
    assert.deepEqual(dateOf("令和元年（2019年）5月1日"), ["2019-05-01"]);
    assert.deepEqual(dateOf("平成31年(2019年)4月30日"), ["2019-04-30"]);
    assert.deepEqual(quantityOf("令和6年（2024年）12月17日"), []);
    assert.deepEqual(dateOf("令和6年（2024年）"), ["2024"]);
  });

  it("元号の年と括弧の西暦の年が違えば、括弧の外の年を読む", () => {
    assert.deepEqual(dateOf("令和6年（2023年）12月17日"), ["2024-12-17"]);
    assert.deepEqual(dateOf("2023年（令和6年）12月17日"), ["2023-12-17"]);
  });

  it("括弧で言い換えた年で始まる日付は、括弧の中の年を glossYear に持つ", () => {
    const glossOf = (text: string): Attr[] => dates(text).map((mention) => mention.attrs["glossYear"]);
    assert.deepEqual(glossOf("令和6年（2023年）12月17日"), [2023]);
    assert.deepEqual(glossOf("2024年（令和5年）"), [2023]);
    assert.deepEqual(glossOf("令和6（2024）年12月17日"), [2024]);
    assert.deepEqual(glossOf("2024年12月17日、令和6年12月17日、12月17日"), [undefined, undefined, undefined]);
    assert.deepEqual(glossOf("令和6年度（2023年度）"), []);
  });

  it("元号の言い換えでない括弧は、年と月をつながない", () => {
    assert.deepEqual(dateOf("令和6年（予定）12月17日"), ["12-17"]);
    assert.deepEqual(dateOf("令和6年（第2024号）12月17日"), ["12-17"]);
    assert.deepEqual(dateOf("2026年（予定）9月4日"), ["2026", "09-04"]);
    assert.deepEqual(quantityOf("3年（令和8年）"), [
      [3, "年"],
      [8, "年"],
    ]);
  });
});

describe("ISO の日付（2026-10-02）", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["3.1.0（2026-10-02）：追加しました。", ["2026-10-02"]],
    ["## 3.1.1 - 2026-05-08", ["2026-05-08"]],
    ["2026-06-02 時点の設定値", ["2026-06-02"]],
    ["(accessed 2024-12-06)", ["2024-12-06"]],
    ["2026-04-01から2026-04-03まで", ["2026-04-01", "2026-04-03"]],
    ["２０２６-１０-０２に公開", ["2026-10-02"]],
    ["2026-04-01 と 2026年5月1日", ["2026-04-01", "2026-05-01"]],
    ["2026-02-30 は暦に無い", ["2026-02-30"]],
  ];
  cases.forEach(([text, expected]) => {
    it(text, () => assert.deepEqual(dateOf(text), expected));
  });

  it("ISO の日付の中の数は、数量として数えない", () => {
    assert.deepEqual(quantityOf("2026-10-02日に出荷し、3日で届く。"), [[3, "日"]]);
  });

  it("後ろに書いた曜日を読む", () => {
    assert.deepEqual(
      dates("2026-10-02（金）").map((mention) => mention.attrs["weekday"]),
      [5],
    );
  });

  const notDates: readonly string[] = [
    "バージョン 1.2.3 を使う。",
    "版 1.2026.10.02 を出した。",
    "電話は 03-1234-5678 まで。",
    "フリーダイヤル 0120-12-34",
    "部品番号 1234-56-78",
    "部品番号 2026-10-02-01",
    "番号 1-2026-10-02",
    "2019-2021 年度の計画",
    "2026 年の計画",
    "2026-10 の版",
    "2026-13-02 と 2026-10-32 と 2026-00-10",
    "時刻 2026-10-02T12:00:00Z",
    "ファイル report-2026-10-02.pdf",
    "ファイル 2026-10-02.pdf",
    "https://example.com/2026-10-02/post",
    "20261002 の番号",
  ];
  notDates.forEach((text) => {
    it(`日付でない: ${text}`, () =>
      assert.deepEqual(
        dateOf(text).filter((value) => typeof value === "string" && value.includes("-")),
        [],
      ));
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
    ["1.5", "適用範囲", false],
    ["3.2", "節", true],
    ["1.5", "万人が参加した。", true],
    ["2.1", "億円の予算", true],
    ["1.5", "万を超える", true],
    ["2.4", "億", true],
    ["3.1", "万葉集の成立", false],
    ["4.2", "万一の場合", false],
    ["2.3", "万博の概要", false],
    ["1.3", "万全の体制", false],
    ["1.1", "億劫な作業", false],
  ];
  cases.forEach(([number, rest, expected]) => {
    it(`${number} ${rest} → ${String(expected)}`, () => assert.equal(countedAfter(number, rest), expected));
  });
});

describe("continuesWithMultiplier（桁の語が数の続きか）", () => {
  const morph = (surface: string, detail1: string, detail2 = "*", pos = "名詞"): Morph => ({ start: 0, end: surface.length, surface, pos, detail1, detail2 });
  const numeral = (surface: string): Morph => morph(surface, "数");
  const counter = (surface: string): Morph => morph(surface, "接尾", "助数詞");
  const cases: readonly (readonly [string, readonly Morph[], number, boolean])[] = [
    ["万 人", [numeral("万"), counter("人")], 0, true],
    ["億 で終わる", [numeral("億")], 0, true],
    ["万 を", [numeral("万"), morph("を", "格助詞", "一般", "助詞")], 0, true],
    ["万 。", [numeral("万"), morph("。", "句点", "*", "記号")], 0, true],
    ["万 葉（接尾の名詞）", [numeral("万"), morph("葉", "接尾")], 0, false],
    ["億 単位", [numeral("億"), morph("単位", "一般")], 0, false],
    ["万 一", [numeral("万"), numeral("一")], 0, false],
    ["千 人", [numeral("千"), counter("人")], 0, false],
    ["兆 円", [numeral("兆"), counter("円")], 0, false],
    ["数でない万", [morph("万", "一般")], 0, false],
    ["位置が無い", [numeral("万")], -1, false],
    ["位置が後ろにはみ出す", [numeral("万")], 1, false],
    ["空", [], 0, false],
  ];
  cases.forEach(([name, morphs, index, expected]) => {
    it(`${name} → ${String(expected)}`, () => assert.equal(continuesWithMultiplier(morphs, index), expected));
  });
});

describe("行頭の小数と桁の語は節にならない", () => {
  const articles = (source: string): string[] => {
    const collect = (node: StructureNode): string[] => [...(node.kind === "article" ? [node.address] : []), ...node.children.flatMap(collect)];
    return collect(buildStructure({ path: "c.md", source, language: "ja", markdown: true }, patterns()));
  };

  it("数量の行は節でなく、本物の節は残る", () => {
    const source = lines(
      "# 報告",
      "",
      "## 1 概要",
      "",
      "1.5 万人が参加した。",
      "",
      "2.1 億円の予算を使った。",
      "",
      "1.5 適用範囲",
      "",
      "詳しくは 3.2 節を見る。",
      "",
      "1.5 倍になった。",
    );
    assert.deepEqual(articles(source), ["1", "1.5"]);
  });

  it("辞書が桁の語と助数詞に切る一語で始まる見出しは節のまま", () => {
    const source = lines("# 文学", "", "## 1 古典", "", "1.1 万葉の世界", "", "1.2 万年筆の歴史", "", "1.3 万歳の起こり");
    assert.deepEqual(articles(source), ["1", "1.1", "1.2", "1.3"]);
  });

  it("数量の続きか（構造が読む入口）", () => {
    assert.equal(patterns().countedAfter?.("1.5", "万葉の世界"), false);
    assert.equal(patterns().countedAfter?.("1.5", "万年筆の歴史"), false);
    assert.equal(patterns().countedAfter?.("1.5", "万年前の地層"), true);
    assert.equal(patterns().countedAfter?.("1.5", "万人が参加した。"), true);
    assert.equal(patterns().countedAfter?.("1.5", "万人が万葉集を読む。"), true);
    assert.equal(patterns().countedAfter?.("4.2", "万が一の場合"), false);
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
