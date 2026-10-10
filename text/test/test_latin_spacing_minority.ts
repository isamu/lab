import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { minorityReport } from "../packages/chaff/src/spacing-minority.ts";
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
