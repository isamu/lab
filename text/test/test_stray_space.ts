import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import { phraseJoints } from "../packages/chaff/src/stray-space.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 日本語の語句の途中の空白（stray-space）。例文は自作か、著作権の切れたもの（石川啄木『一握の砂』）。

const RULE = "stray-space";

/** stray-space の指摘を「前の語 後ろの語」で。experimental は切ったまま、名指しで動かす。 */
const strays = (source: string, genre = "business/report", level: Settings[string] = "normal", adapter: LanguageAdapter = ja): string[] =>
  runRules(buildDocument("a.md", source, adapter), loadRules(adapter.id), { [RULE]: level }, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["before"])} ${String(finding.values["after"])}`);

/** 文書の中の境目を「種類:空け方」で。 */
const joints = (source: string): string[] =>
  buildDocument("a.md", source, ja).sentences.flatMap((sentence) =>
    phraseJoints(sentence, source.slice(sentence.span.start, sentence.span.end)).map(
      (joint) => `${joint.kind}:${joint.spaced ? "spaced" : "touching"}:${joint.before}|${joint.after}`,
    ),
  );

// 詰めて書いた、ふつうの業務文の段落。境目の多数派を「詰める」にする。
const PLAIN = "申込書は窓口で受け付けます。書類は担当者が確認して、結果を翌日に知らせます。質問は総務課へ送ってください。";

describe("stray-space: 語句の途中の空白を指摘する", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("助詞と動詞のあいだの空白（さくらさんが 買った）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\nさくらさんが 買った本は、三冊あります。\n`), ["が 買っ"]);
  });

  it("名詞と「する」のあいだの空白（確認 しました）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n資料を確認 しました。\n`), ["確認 し"]);
  });

  it("名詞と助詞のあいだの空白（アプリ が）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n新しいアプリ が起動しません。\n`), ["アプリ が"]);
  });

  it("全角の空白も同じ（書類は\u3000窓口で）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n控えの書類は\u3000窓口で受け取れます。\n`), ["は 窓口"]);
  });

  it("折り返した行の途中の空白も見る（行ではなく文が句点で終わればよい）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\nさくらさんが 買った本は、\n三冊あります。\n`), ["が 買っ"]);
    assert.deepEqual(strays(`${PLAIN}\n\n資料を\n確認 しました。\n`), ["確認 し"]);
  });

  it("疑問文の終わり（？）も文として読む", () => {
    assert.deepEqual(strays(`${PLAIN}\n\nさくらさんが 払ったお金は、いくらでしょうか？\n`), ["が 払っ"]);
  });

  it("relaxed は 3 箇所から", () => {
    const two = `${PLAIN}\n\nさくらさんが 買った本は、三冊あります。資料を確認 しました。\n`;
    assert.deepEqual(strays(two, "business/report", "relaxed"), []);
    assert.deepEqual(strays(two, "business/report", "strict").length, 2);
  });

  it("境目の種類と空け方を読む", () => {
    assert.deepEqual(joints("資料を確認 しました。"), [
      "inside-phrase:touching:資料|を",
      "between-phrases:touching:を|確認",
      "inside-phrase:spaced:確認|し",
      "inside-phrase:touching:し|まし",
      "inside-phrase:touching:まし|た",
    ]);
  });
});

describe("stray-space: 書き手が選んだ空白は指摘しない", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("文節ごとに空ける分かち書きは、文書の書き方", () => {
    const wakachi = "わたしは がっこうへ いきます。きょうは あめが ふって います。ともだちと いっしょに かえります。\n";
    assert.deepEqual(strays(wakachi, "blog/owned-media"), []);
  });

  it("句点で終わらない行（歌・名札・表のような行）は数えない", () => {
    const verse = "東海の小島の磯の白砂に\u3000われ泣きぬれて\u3000蟹とたはむる\n";
    assert.deepEqual(strays(`${PLAIN}\n\n${verse}\n担当は 田中\n\n受付時間は 平日のみ\n`), []);
  });

  it("詩のジャンルでも、句点の無い歌の行は数えない", () => {
    const verse = "東海の小島の磯の白砂に　われ泣きぬれて　蟹とたはむる\n\n頬につたふ　なみだのごはず　一握の砂を示しし人を忘れず\n";
    assert.deepEqual(strays(`${PLAIN}\n\n${verse}`, "literature/poetry"), []);
  });

  it("名札と値（担当 田中）、名前（赤坂 文弥）は名詞どうしで数えない", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n説明は担当 田中が行いました。質問には赤坂 文弥さんが答えました。\n`), []);
  });

  it("二字の接続詞（また）の前は文節の切れ目で、語句の途中ではない", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n会議は午前に終わり また午後に開きます。\n`), []);
  });

  it("見出しと表の中は本文でない", () => {
    assert.deepEqual(strays(`# 申込の 手順\n\n${PLAIN}\n\n| 項目 | 内容 |\n| --- | --- |\n| 書類は 窓口で出します。 | 平日 |\n`), []);
  });

  it("行頭の全角空白の字下げと、行頭の項目の記号（ヘ\u3000）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n\u3000本書は、手続を定めます。\n\nヘ\u3000手のひらの静脈の形を読み取ります。\n`), []);
  });

  it("Markdown の改行（行末の空白二つ）", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n書類を受け取るには  \n窓口へ来てください。\n`), []);
  });

  it("鉤括弧で引いたものの中は、引いた元の空け方", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n読みは「けだし\u3000このあきんど\u3000また」と書かれています。\n`), []);
  });

  it("強調の印を覆ってできた空白は、書き手が空けたものではない", () => {
    assert.deepEqual(strays(`${PLAIN}\n\nさくらさんが**払った**お金です。\n`), []);
    assert.deepEqual(
      joints("さくらさんが**払った**お金です。").filter((joint) => joint.endsWith("が|払っ")),
      ["between-phrases:touching:が|払っ"],
    );
  });

  it("強調やリンクの括弧の隣の空白は、Markdown のための空白", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n目標は**高い精度を得られること** とする。\n`), []);
    assert.deepEqual(strays(`${PLAIN}\n\nさくらさんが **払った**お金です。\n`), []);
    assert.deepEqual(strays(`${PLAIN}\n\n手順は [説明書](https://example.com)にあります。\n`), []);
  });

  it("コードを覆った空白をまたぐ語は、隣り合っていない", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n設定が \`有効\` になります。\n`), []);
  });

  it("英字・数字との境目は latin-spacing が見る", () => {
    assert.deepEqual(strays(`${PLAIN}\n\n設定で PWA を有効にします。\n`), []);
  });

  it("空けるほうが多ければ、空けないほうも指摘しない（少ないほうを決めつけない）", () => {
    const mostlySpaced = "資料は 明日に届きます。会議は 午後に開きます。担当は 田中です。\n";
    assert.deepEqual(
      joints(mostlySpaced).filter((joint) => joint.startsWith("between-phrases")),
      [
        "between-phrases:spaced:は|明日",
        "between-phrases:touching:に|届き",
        "between-phrases:spaced:は|午後",
        "between-phrases:touching:に|開き",
        "between-phrases:spaced:は|田中",
      ],
    );
    assert.deepEqual(strays(mostlySpaced), []);
  });

  it("英語の文書では動かない", () => {
    assert.deepEqual(strays("We  checked the report.\n", "business/report", "normal", en), []);
  });
});
