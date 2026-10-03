import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firstEndingAfter, joinsAcrossBreak, softBreaks, spansWithin, unmaskedSoftBreaks, withoutSpans } from "../packages/chaff/src/soft-break.ts";
import { joinedView, segmentJoined } from "../packages/chaff/src/joined-view.ts";
import { continuedBreaks, wrapBreaks } from "../packages/chaff/src/line-continues.ts";
import { compacted } from "../packages/chaff/src/detectors/gram-place.ts";
import { proseText } from "../packages/chaff/src/measure.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { lineStarts, placeOf } from "../packages/chaff/src/position.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Segmentation, Span, Token } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

const joined = (text: string): string => withoutSpans(text, softBreaks(text));

describe("消える改行: 全角どうしに挟まれた段落内の改行", () => {
  const joins: readonly (readonly [string, string, string])[] = [
    ["漢字と仮名", "刑事裁判に関\nする法律", "刑事裁判に関する法律"],
    ["仮名と漢字", "販売の\n計画", "販売の計画"],
    ["句点の後", "終わる。\n次の文", "終わる。次の文"],
    ["全角の括弧", "ルール\n（試験中）", "ルール（試験中）"],
    ["全角の数字", "第\n２条", "第２条"],
    ["長音記号", "ルー\nル", "ルール"],
    ["半角カナ", "ｶﾀ\nｶﾅ", "ｶﾀｶﾅ"],
    ["サロゲートペアの漢字", "𠮷\n野家", "𠮷野家"],
    ["改行の前に空白 1 つ", "関 \nする", "関する"],
    ["次の行の字下げ", "項目の説明が\n  続く", "項目の説明が続く"],
    ["CRLF", "関\r\nする", "関する"],
  ];
  joins.forEach(([label, input, expected]) => {
    it(`つなぐ: ${label}`, () => assert.equal(joined(input), expected));
  });

  const keeps: readonly (readonly [string, string])[] = [
    ["英字の後", "API\nを使う"],
    ["英字の前", "日本の\nAPI"],
    ["半角数字どうし", "2\n1条"],
    ["英文", "one line\nnext line"],
    ["強制改行（空白 2 つ）", "関  \nする"],
    ["強制改行（バックスラッシュ）", "関\\\nする"],
    ["空行（段落の区切り）", "前の段落。\n\n次の段落。"],
    ["全角空白の字下げ", "前の行。\n　次の行"],
    ["ハングル", "한국\n어"],
    ["空の文字列", ""],
    ["改行の無い文", "一文です。"],
    ["行頭の改行", "\n関する"],
    ["行末の改行", "関する\n"],
  ];
  keeps.forEach(([label, input]) => {
    it(`残す: ${label}`, () => assert.equal(joined(input), input));
  });

  it("消える範囲は改行の前後の空白ごと", () => {
    assert.deepEqual(softBreaks("関 \n  する"), [{ start: 1, end: 5 }]);
  });

  it("前後の文字の判定は全角どうしだけ", () => {
    assert.equal(joinsAcrossBreak("関", "す"), true);
    assert.equal(joinsAcrossBreak("関", "a"), false);
    assert.equal(joinsAcrossBreak("1", "条"), false);
    assert.equal(joinsAcrossBreak("　", "字"), false);
    assert.equal(joinsAcrossBreak("", "字"), false);
  });
});

describe("覆った文字に触れる改行はつながない", () => {
  it("行頭のインラインコードの跡（空白）を越えてつながない", () => {
    const source = "設定を\n`npm`で入れる";
    const prose = "設定を\n     で入れる";
    assert.deepEqual(softBreaks(prose), [{ start: 3, end: 9 }]);
    assert.deepEqual(unmaskedSoftBreaks(source, prose), []);
  });

  it("覆っていなければ prose の改行と同じ", () => {
    const source = "刑事裁判に関\nする法律";
    assert.deepEqual(unmaskedSoftBreaks(source, source), softBreaks(source));
  });
});

describe("並んだ範囲を探す", () => {
  const sorted: readonly Span[] = [
    { start: 2, end: 3 },
    { start: 5, end: 7 },
    { start: 9, end: 10 },
  ];

  it("end が offset より後ろの最初", () => {
    assert.equal(firstEndingAfter(sorted, 0), 0);
    assert.equal(firstEndingAfter(sorted, 3), 1);
    assert.equal(firstEndingAfter(sorted, 6), 1);
    assert.equal(firstEndingAfter(sorted, 7), 2);
    assert.equal(firstEndingAfter(sorted, 10), 3);
    assert.equal(firstEndingAfter([], 5), 0);
  });

  it("outer に収まるものだけ", () => {
    assert.deepEqual(spansWithin(sorted, { start: 2, end: 7 }), sorted.slice(0, 2));
    assert.deepEqual(spansWithin(sorted, { start: 3, end: 9 }), [{ start: 5, end: 7 }]);
    assert.deepEqual(spansWithin(sorted, { start: 6, end: 10 }), [{ start: 9, end: 10 }]);
    assert.deepEqual(spansWithin(sorted, { start: 0, end: 1 }), []);
  });
});

describe("つないだ文字列の範囲を元に戻す", () => {
  const text = "裁判に関\nする法律の\n計画";
  const breaks = softBreaks(text);
  const view = joinedView(text, breaks);

  it("つないだ文字列", () => assert.equal(view.text, "裁判に関する法律の計画"));

  it("改行をまたぐ語は改行ごと覆う", () => {
    const start = view.text.indexOf("関する");
    assert.deepEqual(view.toSource({ start, end: start + "関する".length }), { start: 3, end: 7 });
  });

  it("改行の直後から始まる語は改行の後ろを指す", () => {
    const start = view.text.indexOf("計画");
    assert.deepEqual(view.toSource({ start, end: start + 2 }), { start: text.indexOf("計画"), end: text.indexOf("計画") + 2 });
  });

  it("改行の直前で終わる語は改行を含まない", () => {
    const start = view.text.indexOf("の計画");
    assert.deepEqual(view.toSource({ start, end: start + 1 }), { start: text.indexOf("の\n"), end: text.indexOf("の\n") + 1 });
  });

  it("空の範囲は空のまま", () => {
    const span = view.toSource({ start: 4, end: 4 });
    assert.equal(span.start, span.end);
  });

  it("消える改行が無ければ位置は動かない", () => {
    const plain = joinedView("one line\nnext", []);
    assert.equal(plain.text, "one line\nnext");
    assert.deepEqual(plain.toSource({ start: 3, end: 9 }), { start: 3, end: 9 });
  });

  // 性質: つないだ文字列の各文字は、戻した位置の元の文字と同じ。戻した範囲から改行を除けば、つないだ範囲と同じ文字列。
  const PIECES = ["関", "する", "の", "\n", " \n", "\n  ", "  \n", "a", "2", "。", "\n\n", "𠮷", "　"];
  const SEED = 20260929;
  it(`生成した文字列のどの範囲も元に戻る (seed ${String(SEED)})`, () => {
    let seed = SEED;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    Array.from({ length: 300 }).forEach(() => {
      const source = Array.from({ length: 1 + Math.floor(next() * 12) }, () => PIECES[Math.floor(next() * PIECES.length)] ?? "").join("");
      const found = softBreaks(source);
      const generated = joinedView(source, found);
      const length = generated.text.length;
      const start = Math.floor(next() * (length + 1));
      const end = start + Math.floor(next() * (length - start + 1));
      const back = generated.toSource({ start, end });
      const inside = found
        .filter((span) => span.start >= back.start && span.end <= back.end)
        .map((span) => ({ start: span.start - back.start, end: span.end - back.start }));
      assert.equal(withoutSpans(source.slice(back.start, back.end), inside), generated.text.slice(start, end), JSON.stringify({ source, start, end }));
    });
  });
});

describe("語の途中の改行（行の折り返し）", () => {
  const token = (start: number, end: number, surface: string): Token => ({ span: { start, end }, surface, pos: "NOUN" });
  const breaks: readonly Span[] = [{ start: 4, end: 5 }];

  it("語が改行をまたげば折り返し", () => assert.deepEqual(wrapBreaks(breaks, [token(3, 7, "関する")]), breaks));
  it("語の切れ目の改行は入れない", () => assert.deepEqual(wrapBreaks(breaks, [token(2, 4, "御中"), token(5, 7, "各国")]), []));
  it("語が無ければ入れない", () => assert.deepEqual(wrapBreaks(breaks, []), []));
});

describe("行が続いている改行", () => {
  const token = (start: number, end: number, surface: string, pos: string): Token => ({ span: { start, end }, surface, pos });
  const breaks: readonly Span[] = [{ start: 2, end: 3 }];

  it("語をまたぐ", () => assert.deepEqual(continuedBreaks(breaks, [token(1, 4, "関する", "VERB")]), breaks));
  it("助詞で終わる行", () => assert.deepEqual(continuedBreaks(breaks, [token(1, 2, "の", "ADP")]), breaks));
  it("接続助詞で終わる行", () => assert.deepEqual(continuedBreaks(breaks, [token(1, 2, "て", "SCONJ")]), breaks));
  it("接続詞で終わる行", () => assert.deepEqual(continuedBreaks(breaks, [token(1, 2, "や", "CCONJ")]), breaks));
  it("読点で終わる行", () => assert.deepEqual(continuedBreaks(breaks, [token(1, 2, "、", "PUNCT")]), breaks));
  it("名詞で終わる行は見出しや並びと見分けられない", () =>
    assert.deepEqual(continuedBreaks(breaks, [token(0, 2, "登録", "NOUN"), token(3, 5, "登録", "NOUN")]), []));
  it("括弧で終わる行", () => assert.deepEqual(continuedBreaks(breaks, [token(1, 2, "）", "PUNCT")]), []));
  it("改行の後ろの助詞は数えない", () => assert.deepEqual(continuedBreaks(breaks, [token(3, 4, "の", "ADP")]), []));
  it("語が無ければ続かない", () => assert.deepEqual(continuedBreaks(breaks, []), []));
});

describe("segmentJoined", () => {
  const fake = (text: string): Segmentation => ({
    sentences: [{ span: { start: 0, end: text.length }, text, tokens: [{ span: { start: 0, end: text.length }, surface: text, pos: "NOUN" }] }],
  });

  it("消える改行が無ければ segment の結果そのまま", () => {
    const direct = fake("one\ntwo");
    assert.deepEqual(
      segmentJoined("one\ntwo", [], () => direct),
      direct.sentences,
    );
  });

  it("語が無ければ（品詞を読まない adapter）改行ごと渡す", () => {
    const seen: string[] = [];
    const plain = (text: string): Segmentation => {
      seen.push(text);
      return { sentences: [{ span: { start: 0, end: text.length }, text }] };
    };
    const sentences = segmentJoined("関\nする", softBreaks("関\nする"), plain);
    assert.deepEqual(sentences, [{ span: { start: 0, end: 4 }, text: "関\nする" }]);
    assert.deepEqual(seen, ["関する", "関\nする"]);
  });

  it("文の text は元の文字列、語の surface はつないだもの", () => {
    const [sentence] = segmentJoined("関\nする", softBreaks("関\nする"), fake);
    assert.equal(sentence?.text, "関\nする");
    assert.deepEqual(sentence?.span, { start: 0, end: 4 });
    assert.equal(sentence?.tokens?.[0]?.surface, "関する");
    assert.deepEqual(sentence?.tokens?.[0]?.span, { start: 0, end: 4 });
    assert.deepEqual(sentence?.wrapBreaks, [{ start: 1, end: 2 }]);
  });
});

describe("文書: 日本語の段落の中の改行", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const findings = (path: string, source: string, rule: string) =>
    runRules(buildDocument(path, source, ja), loadRules("ja"), measuredOffOn("business/report"), true, "business/report").findings.filter(
      (finding) => finding.rule === rule,
    );

  it("改行をまたぐ語を 1 語として解析し、位置は元の文字列のまま", () => {
    const source = "# 試験\n\n本件は、刑事裁判に関\nする法律の規定について争うものである。\n";
    const doc = buildDocument("t.md", source, ja);
    const word = doc.sentences.flatMap((sentence) => sentence.tokens ?? []).find((token) => token.surface === "に関する");
    const at = source.indexOf("に関\nする");
    assert.deepEqual(word?.span, { start: at, end: at + "に関\nする".length });
    const first = doc.sentences[0];
    assert.equal(first?.text, source.slice(first?.span.start ?? 0, first?.span.end ?? 0));
    assert.match(doc.sentences[0]?.text ?? "", /関\nする/u);
    assert.equal(proseText(doc.sentences[0] ?? { span: { start: 0, end: 0 }, text: "" }), "本件は、刑事裁判に関する法律の規定について争うものである。");
  });

  it("「の」の連なりを改行の向こうまで数え、指摘は最初の「の」を指す", () => {
    const source = "# 試験\n\n弊社の新製品の販売の\n計画の概要を説明する。\n";
    const [finding] = findings("t.md", source, "no-doubled-joshi");
    assert.equal(finding?.values["count"], 4);
    const offset = source.indexOf("の新製品");
    assert.equal(finding?.values["offset"], offset);
    const place = placeOf(lineStarts(source), offset);
    assert.equal(finding?.line, place.line);
    assert.equal(finding?.column, place.column);
    assert.deepEqual(place, { line: 3, column: 3 });
  });

  it("改行の後ろの「の」を指す指摘も元の行と桁", () => {
    const source = "# 試験\n\n先に言う。概要を\n弊社の新製品の販売の計画の説明とする。\n";
    const [finding] = findings("t.md", source, "no-doubled-joshi");
    assert.deepEqual({ line: finding?.line, column: finding?.column }, { line: 4, column: 3 });
    assert.equal(finding?.values["offset"], source.indexOf("の新製品"));
  });

  it("語の途中で折り返した漢字の連なりを数える", () => {
    const source = "# 試験\n\n情報処理推進機構認\n定試験の制度を見直した。\n";
    const [finding] = findings("t.md", source, "max-kanji-continuous");
    assert.equal(finding?.values["word"], "情報処理推進機構認定試験");
    assert.deepEqual({ line: finding?.line, column: finding?.column }, { line: 3, column: 1 });
  });

  it("1 行に 1 項目の並び（宛先）は、語の切れ目の改行なので漢字の連なりにしない", () => {
    const source = "# 試験\n\n各国公私立高等専門学校担当課\n各都道府県教育委員会専修学校主管課 御中\n";
    const words = findings("t.md", source, "max-kanji-continuous").map((finding) => finding.values["word"]);
    assert.equal(
      words.some((word) => typeof word === "string" && word.includes("担当課各都道府県")),
      false,
    );
  });

  it("名詞で終わる行（番号だけの見出し）の改行は残す", () => {
    const source = "# 試験\n\n2.1 注文の登録\n登録は1回の要求につき最大100件までとする。\n";
    assert.deepEqual(findings("t.md", source, "doubled-word"), []);
  });

  it("テキストの文書は行をそのまま読む（法令は 1 行 1 号）", () => {
    const source = "弊社の新製品の販売の\n計画の概要を説明する。\n";
    const [finding] = findings("t.txt", source, "no-doubled-joshi");
    assert.equal(finding?.values["count"], 3);
    const doc = buildDocument("t.txt", source, ja);
    assert.equal(
      doc.sentences.some((sentence) => sentence.wrapBreaks !== undefined),
      false,
    );
  });

  it("英字に接する改行と句点の後の改行は前と同じ", () => {
    const source = "# 試験\n\nこの API\nを使う。次の文です。\n最後の文です。\n";
    const doc = buildDocument("t.md", source, ja);
    assert.deepEqual(
      doc.sentences.map((sentence) => sentence.text),
      ["この API\nを使う。", "次の文です。", "最後の文です。"],
    );
    assert.equal(
      doc.sentences.flatMap((sentence) => sentence.tokens ?? []).some((token) => token.surface.includes("\n")),
      true,
    );
  });

  it("英語の文書は変わらない", () => {
    const source = "# Test\n\nThis is one line\nthat continues here. Another sentence.\n";
    const doc = buildDocument("t.md", source, en);
    assert.deepEqual(
      doc.sentences.map((sentence) => sentence.text),
      ["This is one line\nthat continues here.", "Another sentence."],
    );
    assert.equal(
      doc.sentences.some((sentence) => sentence.wrapBreaks !== undefined),
      false,
    );
  });
});

describe("n-gram の詰め方も消える改行を空白にしない", () => {
  it("word 単位", () => assert.equal(compacted("東京都港\n区新橋 two\nwords", "word").text, "東京都港区新橋 two words"));
  it("char 単位は前から空白を全部除く", () => assert.equal(compacted("東京都港\n区 a\nb", "char").text, "東京都港区ab"));
});
