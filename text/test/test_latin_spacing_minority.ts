import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { minorityReport, withoutSideOnTie } from "../packages/chaff/src/spacing-minority.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// リンクの文字と版番号を数えないこと、少ないほうが多ければ 1 件にまとめること。例文はすべて自作。

await ja.prepare?.({ pos: true });

const spacing = (source: string): string[] => latinSpacing(ja, source, "business/report");

/** spaced 箇所空けて、touching 箇所詰めた境目。並びは空けたほうが先。 */
const boundaries = (spaced: number, touching: number): { readonly spaced: boolean }[] => [
  ...Array.from({ length: spaced }, () => ({ spaced: true })),
  ...Array.from({ length: touching }, () => ({ spaced: false })),
];

describe("minorityReport", () => {
  it("混ざっていなければ、または空なら言わない", () => {
    assert.equal(minorityReport(boundaries(0, 9), 1), undefined);
    assert.equal(minorityReport(boundaries(9, 0), 1), undefined);
    assert.equal(minorityReport([], 1), undefined);
  });

  it("少ないほうが limit に届かなければ言わない", () => {
    assert.equal(minorityReport(boundaries(2, 20), 3), undefined);
    assert.equal(minorityReport(boundaries(3, 20), 3)?.mode, "each");
  });

  it("少ないほうが少なければ 1 箇所ずつ", () => {
    const report = minorityReport(boundaries(1, 2), 1);
    assert.equal(report?.mode, "each");
    assert.equal(report.mode === "each" ? report.odd.length : 0, 1);
    assert.equal(minorityReport(boundaries(4, 6), 1)?.mode, "each");
    assert.equal(minorityReport(boundaries(9, 58), 1)?.mode, "each");
  });

  it("2 割ちょうどは 1 箇所ずつ、超えたら 1 件にまとめる", () => {
    assert.equal(minorityReport(boundaries(5, 20), 1)?.mode, "each");
    assert.deepEqual(minorityReport(boundaries(5, 19), 1), { mode: "mixed", first: { spaced: true }, odd: 5, spaced: 5, touching: 19 });
  });

  it("まとめても両方の数を言い、どちら側の少数派でも同じ", () => {
    assert.deepEqual(minorityReport(boundaries(56, 38), 1), { mode: "mixed", first: { spaced: false }, odd: 38, spaced: 56, touching: 38 });
  });
});

describe("latin-spacing はリンクの文字の中を数えない", () => {
  it("リンクの文字の空け方は引いた題のもの", () => {
    assert.deepEqual(
      spacing("# 試し\n\nAIの話をします。UIを作り、APIを呼び、CIで確かめます。[strict を入れても as は止まらない](https://example.com) を読みました。\n"),
      [],
    );
  });

  it("リンクの外の本文は数える", () => {
    assert.deepEqual(spacing("# 試し\n\nAIの話をします。UIを作り、APIを呼び、CI で確かめます。[記事](https://example.com)を読みました。\n"), [
      "英字:空けています",
    ]);
  });
});

describe("latin-spacing はコロンで書いた時刻と、メールアドレス・URL の前後を数えない", () => {
  it("時刻の前後の空け方は、数量の空け方の票にしない", () => {
    assert.deepEqual(spacing("# 試し\n\n受付は 13:30 から始めます。懇親会は終了後の17:15から行います。会場まで徒歩5分、定員は30名です。\n"), []);
    assert.deepEqual(spacing("# 試し\n\n- 10:30 博多駅で合流（地下鉄で約10分）\n- 17:00 ホテルにチェックイン（駅から徒歩2分）\n- 18:00 懇親会\n"), []);
  });

  it("AM・PM を付けた時刻の後ろの空白も、数量の空け方の票にしない", () => {
    const body = "# 試し\n\n会場まで徒歩5分、定員は30名、参加費は500円です。";
    assert.deepEqual(spacing(`${body}\n\n- 日時: 11月4日 (9:30AM 開場)\n`), []);
    assert.deepEqual(spacing(`${body}\n\n- 日時: 11月4日 (9:30 p.m. 開場)\n`), []);
  });

  it("AM・PM に見えて時刻の一部でない英字の後ろは、これまでどおり数える", () => {
    const body = "# 試し\n\n会場まで徒歩5分、定員は30名、参加費は500円です。";
    assert.deepEqual(spacing(`${body}受付は 30AM 開場です。\n`), ["後ろの数字:空けています", "前の数字:空けています"]);
  });

  it("時刻でない数の空け方は、これまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\n13:30から始めます。会場まで徒歩 5分、定員は30名、参加費は500円です。\n"), ["後ろの数字:空けています"]);
  });

  it("メールアドレス・URL の後ろの空白は区切り", () => {
    assert.deepEqual(spacing("# 試し\n\n端末のOSと、アプリのIDを記録します。質問は privacy@example.com で受け付けます。\n"), []);
    assert.deepEqual(spacing("# 試し\n\n端末のOSと、アプリのIDを記録します。手順は https://example.com/faq にあります。\n"), []);
  });

  it("アドレスでない英字の空け方は、これまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\n端末のOSと、アプリのIDを記録します。質問は Mail で受け付けます。\n"), ["英字:空けています", "英字:空けています"]);
  });
});

describe("latin-spacing は予約番号・型番のような番号の前後を数えない", () => {
  it("番号の前後の空白は番号を文から区切るもので、「2泊」「3名」の数と一緒に数えない", () => {
    assert.deepEqual(spacing("# 試し\n\nご宿泊は2泊、大人2名です。ご連絡には予約番号 MN-48215 が必要です。予約番号 MN-48215 をお伝えください。\n"), []);
    assert.deepEqual(spacing("# 試し\n\n部品は3個、型番 SB-210 と KM-SP300 を使います。注文番号 A1234567 で届きます。\n"), []);
  });

  it("番号でない英字と数の空け方は、これまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\nこのITシステムとUIを使います。予約番号 MN-48215 を伝え、この IT システムで調べます。\n"), [
      "英字:空けています",
      "英字:空けています",
    ]);
    assert.deepEqual(spacing("# 試し\n\nご宿泊は2泊、大人2名です。予約番号 MN-48215 を伝え、朝食は 1回です。\n"), ["後ろの数字:空けています"]);
  });

  it("数字の短い名前（UTF-8）は番号ではなく、これまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\n3回呼び、5件返し、UTF-8 で送ります。\n"), ["前の数字:空けています"]);
  });
});

describe("latin-spacing は版番号を数えない", () => {
  it(". でつないだ 3 組以上の数字は番号", () => {
    assert.deepEqual(spacing("# 試し\n\n2026年に3回出しました。5件の報告と10人の利用者がいます。版はいまも 1.0.0 です。\n"), []);
    assert.deepEqual(spacing("# 試し\n\n2026年に3回出しました。5件の報告と10人の利用者がいます。手順は 3.1.2 にあります。\n"), []);
  });

  it("2 組は小数で、数量として数える", () => {
    assert.deepEqual(spacing("# 試し\n\n2026年に3回出しました。5件の報告と10人の利用者がいます。速さはいまも 1.5 倍です。\n"), [
      "後ろの数字:空けています",
      "前の数字:空けています",
    ]);
  });
});

describe("latin-spacing は書き方が二通りの文書を 1 件で言う", () => {
  const rules = loadRules("ja");
  const rule = rules.find((entry) => entry.id === "latin-spacing");
  const messages = (source: string): string[] =>
    rule === undefined
      ? []
      : runRules(buildDocument("a.md", source, ja), rules, { "latin-spacing": "normal" }, false, "business/report")
          .findings.filter((finding) => finding.rule === "latin-spacing")
          .map((finding) => messageOf(rule, finding, "ja"));

  it("少ないほうが多ければ、両方の数を言う 1 件", () => {
    const source = "# 試し\n\nAPI を呼ぶ。JSON を返す。ID を保存する。URL を開く。CSV を読む。PDFを作る。HTMLを書く。XMLを読む。CSSを直す。SQLを流す。\n";
    assert.deepEqual(messages(source), ["日本語と英字のあいだを、空ける所が 5 箇所、詰める所が 5 箇所あります。この文書には書き方が二通りあります"]);
  });

  it("少ないほうが少なければ、1 箇所ずつ言う", () => {
    const source = "# 試し\n\nAPIを呼ぶ。JSONを返す。IDを保存する。URLを開く。CSVを読む。PDFを作る。HTMLを書く。XMLを読む。CSSを直す。SQL を流す。\n";
    assert.equal(messages(source).length, 1);
    assert.match(messages(source)[0] ?? "", /空けています/u);
  });
});

describe("latin-spacing は番号の中や項目の値を区切る空白を数えず、同数なら言わない", () => {
  it("桁の区切りの無い 6 桁以上の番号の前後は数えない（口座番号）", () => {
    assert.deepEqual(spacing("# 試し\n\n振込手数料は1件につき330円です。お振込みには、口座番号 7203518 をお伝えください。\n"), []);
  });

  it("助数詞の続く大きな数は数量で、これまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\n振込手数料は1件につき330円です。残高は 1250000円です。\n"), ["後ろの数字:空けています"]);
  });

  it("ナンバープレートの中と前後の空白は数えない", () => {
    assert.deepEqual(spacing("# 試し\n\n登録番号ひばり野 330 ね 48-15 のお車は、当社で2年間保管します。走行距離は45,120kmです。\n"), []);
  });

  it("項目名とコロンの後ろに値の組を並べた行で、組と組のあいだの空白は数えない", () => {
    assert.deepEqual(spacing("# 試し\n\n振込手数料は1件につき330円です。\n\n振込先：みなと銀行 本店営業部 普通 1234567\n"), []);
    assert.deepEqual(spacing("# 試し\n\n- 所属：経済学部 経済学科 1年\n- 学費：820,000円\n\n学籍番号26B4172の通知書です。\n"), []);
    assert.deepEqual(spacing("# 試し\n\n専有面積は25.5㎡です。広さは2部屋で9畳です。\n\n物件：メゾンかえで 203号室\n"), []);
  });

  it("量の前置き（約）や、値を文で書いた行の空白は、これまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\n期間：約 3 か月\n\n契約は2年で、更新は1回までです。\n"), ["後ろの数字:空けています", "前の数字:空けています"]);
    assert.deepEqual(spacing("# 試し\n\n会場：本社は 5階で行います。\n\n定員は30名、参加費は500円です。\n"), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing("# 試し\n\n参加者100人、来場者200人を見込みます。\n\n目標：参加者 100人を想定\n"), ["後ろの数字:空けています"]);
  });

  it("短い項目名と値を空白で並べただけの組（行の頭・箇条書き・括弧の中・読点の後ろ）の空白は数えない", () => {
    const body = "# 試し\n\n振込手数料は1件につき330円です。定員は30名、参加費は500円です。\n\n";
    assert.deepEqual(spacing(`${body}最高速度 40km/h\n`), []);
    assert.deepEqual(spacing(`${body}- 定員 30名\n- 会費 500円\n`), []);
    assert.deepEqual(spacing(`${body}1. 定員 30名\n`), []);
    assert.deepEqual(spacing(`${body}受付窓口（内線 3839）\n`), []);
    assert.deepEqual(spacing(`${body}電話 03-1234-5678、内線 3839～40\n`), []);
  });

  it("文の中の値や、量の前置き・値の後ろの語のある組の空白は、これまでどおり数える", () => {
    const body = "# 試し\n\n振込手数料は1件につき330円です。定員は30名、参加費は500円です。\n\n";
    assert.deepEqual(spacing(`${body}当日は最高速度 40km/hで走ります。\n`), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing(`${body}定員 30名で行います。\n`), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing(`${body}最高速度 40km/h。\n`), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing(`${body}受付は、内線 3839 までお電話ください。\n`), ["後ろの数字:空けています", "前の数字:空けています"]);
    assert.deepEqual(spacing(`${body}約 30名\n`), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing(`${body}およそ 30名\n`), ["後ろの数字:空けています"]);
  });

  it("英字の前後の空け方は、項目の組とは関わらずこれまでどおり数える", () => {
    assert.deepEqual(spacing("# 試し\n\nPythonを使い、Rubyで書き、Goで動かします。次は Python を使います。\n"), ["英字:空けています", "英字:空けています"]);
  });

  it("表の升目の空白は数えない", () => {
    assert.deepEqual(spacing("# 試し\n\n| 口座 | 場所 |\n| --- | --- |\n| 普通 1234567 | 本社 5階 |\n\n手数料は330円、定員は30名です。\n"), []);
  });

  it("1 対 1 の同数には少ないほうが無いので言わず、1 対 2 なら言う", () => {
    assert.deepEqual(spacing("# 試し\n\n専有面積は25.5㎡です。洋室は 8畳です。\n"), []);
    assert.deepEqual(spacing("# 試し\n\n専有面積は25.5㎡です。洋室は 8畳、和室は6畳です。\n"), ["後ろの数字:空けています"]);
  });

  it("2 対 2 以上の同数は、どちらの側にも立たず、書き方が二通りあることを 1 件で言う", () => {
    assert.deepEqual(spacing("# 試し\n\n専有面積は25.5㎡、洋室は8畳です。和室は 6畳、納戸は 2畳です。\n"), ["後ろの数字:undefined"]);
  });

  it("withoutSideOnTie: 同数でなければそのまま、1 対 1 は無し、2 対 2 からは二通りの 1 件", () => {
    assert.equal(withoutSideOnTie(minorityReport(boundaries(1, 1), 1), boundaries(1, 1)), undefined);
    assert.deepEqual(withoutSideOnTie(minorityReport(boundaries(2, 2), 1), boundaries(2, 2)), {
      mode: "mixed",
      first: { spaced: true },
      odd: 2,
      spaced: 2,
      touching: 2,
    });
    assert.deepEqual(withoutSideOnTie(minorityReport(boundaries(1, 2), 1), boundaries(1, 2)), minorityReport(boundaries(1, 2), 1));
    assert.deepEqual(withoutSideOnTie(minorityReport(boundaries(6, 6), 1), boundaries(6, 6)), minorityReport(boundaries(6, 6), 1));
    assert.equal(withoutSideOnTie(undefined, []), undefined);
  });

  it("文の中で空け方が混ざっていれば、これまでどおり言う", () => {
    assert.deepEqual(spacing("# 試し\n\niPhone 15を買い、Pixel 8 を返し、Galaxy 9を売ります。\n"), ["英字:空けています"]);
  });
});
