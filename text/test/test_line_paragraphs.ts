import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineParagraphs } from "../packages/chaff/src/line-paragraphs.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Span } from "../packages/chaff/src/plugin.ts";

/** 文の境目を「。」「. 」で決める素朴な分割。段落の割り方だけを試すため、解析器に頼らない。 */
const naiveSentences = (text: string): Span[] =>
  [...text.matchAll(/[^。.\s][^。.]*[。.]?/gu)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

const whole = (text: string): Span => ({ start: 0, end: text.length });
const pieces = (text: string): string[] => lineParagraphs(text, whole(text), naiveSentences(text)).map((span) => text.slice(span.start, span.end));

/** 2 文の行 3 つと 1 文の行 1 つ。1 行 1 段落の形のいちばん小さいもの。 */
const LINE_SHAPED = ["一つ目。二つ目。", "三つ目。四つ目。", "五つ目。", "六つ目。七つ目。"];

describe("lineParagraphs: 1 行 1 段落で書いた段落を行で割る", () => {
  it("2 文以上の行が 3 つ以上、3 分の 1 以上あれば、文の終わる改行で割る", () => {
    assert.deepEqual(pieces(LINE_SHAPED.join("\n")), LINE_SHAPED);
  });

  it("文の途中の改行（折り返し）では割らない", () => {
    const text = ["一つ目。二つ目。", "三つ目。四つ目の", "続き。", "五つ目。六つ目。", "七つ目。八つ目。"].join("\n");
    assert.deepEqual(pieces(text), ["一つ目。二つ目。", "三つ目。四つ目の\n続き。", "五つ目。六つ目。", "七つ目。八つ目。"]);
  });

  it("2 文以上の行は、行の両端が文の境目でなければ数えない（固定幅の折り返しで偶然そろった行）", () => {
    const text = ["一つ目。二つ目。", "三つ目。四つ目の", "続き。五つ目。六つ目。", "七つ目。八つ目。"].join("\n");
    assert.deepEqual(pieces(text), [text]);
  });

  it("折り返しが多い段落（固定幅の折り返し）は割らない", () => {
    const text = "一つ目の文は長く\n続いて終わる。二つ目の\n文も長く続く。三つ目も\n折り返して終わる。四つ目。五つ目も\n続く。六つ目。七つ目。";
    assert.deepEqual(pieces(text), [text]);
  });

  it("発言者の行は、続く発言の行と同じ段落に入る（議事録）", () => {
    const text = ["○議長", "一。二。", "三。四。", "○委員", "五。六。", "七。八。", "○議長", "九。十。", "十一。十二。"].join("\n");
    assert.deepEqual(pieces(text), ["○議長\n一。二。", "三。四。", "○委員\n五。六。", "七。八。", "○議長\n九。十。", "十一。十二。"]);
  });

  it("空白だけの行（覆った発言者の名前）は段落を終えず、続く行と同じ段落に入る", () => {
    const text = ["   ", "一。二。", "三。四。", "五。六。", "   ", "七。八。", "九。十。"].join("\n");
    assert.deepEqual(pieces(text), ["   \n一。二。", "三。四。", "五。六。", "   \n七。八。", "九。十。"]);
  });

  const multiThenWrapped = (wrappedLines: number): string =>
    ["一。二。", "三。四。", "五。六。", ...Array.from({ length: wrappedLines }, (_, index) => `折${String(index)}`), "終わり。"].join("\n");

  it("文で終わる行がちょうど半分なら割る", () => {
    assert.deepEqual(pieces(multiThenWrapped(4)), ["一。二。", "三。四。", "五。六。", "折0\n折1\n折2\n折3\n終わり。"]);
  });

  it("文で終わる行が半分に届かなければ割らない", () => {
    const text = multiThenWrapped(5);
    assert.deepEqual(pieces(text), [text]);
  });

  it("1 行 1 文の段落（意味の切れ目で改行する書き方）は割らない", () => {
    const text = "一つ目。\n二つ目。\n三つ目。\n四つ目。";
    assert.deepEqual(pieces(text), [text]);
  });

  it("1 行 1 文の段落にたまに 2 文の行が混じっても割らない", () => {
    const text = ["一つ目。二つ目。", "三つ目。", "四つ目。", "五つ目。六つ目。", "七つ目。"].join("\n");
    assert.deepEqual(pieces(text), [text]);
  });

  const multiAmongSingles = (singles: number): string =>
    ["一。二。", "三。四。", "五。六。", ...Array.from({ length: singles }, (_, index) => `単${String(index)}。`)].join("\n");

  it("2 文以上の行が 3 つで、割った段落の 5 分の 1 ちょうどなら割る", () => {
    assert.equal(pieces(multiAmongSingles(12)).length, 15);
  });

  it("2 文以上の行が 3 つあっても、5 分の 1 に届かなければ割らない", () => {
    const text = multiAmongSingles(13);
    assert.deepEqual(pieces(text), [text]);
  });

  it("2 文以上の行が 2 つでは割らない", () => {
    const text = ["一。二。", "三。四。", "五。"].join("\n");
    assert.deepEqual(pieces(text), [text]);
  });

  it("英語も同じ形なら割る", () => {
    const lines = ["One. Two.", "Three. Four.", "Five.", "Six. Seven."];
    assert.deepEqual(pieces(lines.join("\n")), lines);
  });

  it("CRLF の行も割る。割った段落は改行を含まない", () => {
    assert.deepEqual(pieces(LINE_SHAPED.join("\r\n")), LINE_SHAPED);
  });

  it("段落の外の改行は見ない（割る場所は段落の中）", () => {
    const text = `前置き\n\n${LINE_SHAPED.join("\n")}`;
    const paragraph = { start: text.indexOf("一"), end: text.length };
    const sentences = naiveSentences(text.slice(paragraph.start)).map((span) => ({ start: span.start + paragraph.start, end: span.end + paragraph.start }));
    const found = lineParagraphs(text, paragraph, sentences);
    assert.deepEqual(
      found.map((span) => text.slice(span.start, span.end)),
      LINE_SHAPED,
    );
  });

  it("文の範囲が前後の空白（改行、字下げの全角空白）を含んでいても、文の終わる改行と読む", () => {
    const lines = ["　一つ目。二つ目。", "　三つ目。四つ目。", "　五つ目。", "　六つ目。七つ目。"];
    const text = lines.join("\n");
    const trailing = (from: number): number => from + (text.slice(from).length - text.slice(from).trimStart().length);
    const ends = [...text.matchAll(/。/gu)].map((match) => match.index + 1);
    const withSpaces = ends.map((end, index) => ({ start: ends[index - 1] ?? 0, end: trailing(end) }));
    assert.deepEqual(
      lineParagraphs(text, whole(text), withSpaces).map((span) => text.slice(span.start, span.end)),
      lines,
    );
  });

  const unchanged: readonly (readonly [string, string, readonly Span[]])[] = [
    ["空の段落", "", []],
    ["改行の無い段落", "一つ目。二つ目。三つ目。", naiveSentences("一つ目。二つ目。三つ目。")],
    ["文が無い段落（覆われた中身だけ）", "`a`\n`b`\n`c`", []],
  ];
  unchanged.forEach(([label, text, sentences]) => {
    it(`そのまま返す: ${label}`, () => assert.deepEqual(lineParagraphs(text, whole(text), sentences), [whole(text)]));
  });
});

const RULES_JA = loadRules("ja");
const RULES_EN = loadRules("en");

const findingsOf = (source: string, adapter: LanguageAdapter, path = "t.md"): string[] =>
  runRules(buildDocument(path, source, adapter), adapter.id === "en" ? RULES_EN : RULES_JA, {}, true, "blog/essay").findings.map((finding) => finding.rule);

const paragraphSizes = (source: string, adapter: LanguageAdapter, path = "t.md"): number[] =>
  buildDocument(path, source, adapter).paragraphs.map((paragraph) => paragraph.sentences.length);

/** 寺田寅彦「天災と国防」（青空文庫、著作権の切れた作品）の冒頭。1 行が 1 段落で、段落の間に空行が無い。 */
const TENSAI = [
  "「非常時」というなんとなく不気味なしかしはっきりした意味のわかりにくい言葉がはやりだしたのはいつごろからであったか思い出せないが、ただ近来何かしら日本全国土の安寧を脅かす黒雲のようなものが遠い水平線の向こう側からこっそりのぞいているらしいという、言わば取り止めのない悪夢のような不安の陰影が国民全体の意識の底層に揺曳していることは事実である。そうして、その不安の渦巻の回転する中心点はと言えばやはり近き将来に期待される国際的折衝の難関であることはもちろんである。",
  "そういう不安をさらにあおり立てでもするように、ことしになってからいろいろの天変地異が踵を次いでわが国土を襲い、そうしておびただしい人命と財産を奪ったように見える。あの恐ろしい函館の大火や近くは北陸地方の水害の記憶がまだなまなましいうちに、さらに九月二十一日の近畿地方大風水害が突発して、その損害は容易に評価のできないほど甚大なものであるように見える。国際的のいわゆる「非常時」は、少なくも現在においては、無形な実証のないものであるが、これらの天変地異の「非常時」は最も具象的な眼前の事実としてその惨状を暴露しているのである。",
  "一家のうちでも、どうかすると、直接の因果関係の考えられないようないろいろな不幸が頻発することがある。すると人はきっと何かしら神秘的な因果応報の作用を想像して祈祷や厄払いの他力にすがろうとする。国土に災禍の続起する場合にも同様である。",
  "しかしここで一つ考えなければならないことで、しかもいつも忘れられがちな重大な要項がある。それは、文明が進めば進むほど天然の暴威による災害がその劇烈の度を増すという事実である。",
].join("\n");

/** 夏目漱石「夢十夜」第一夜（青空文庫）。読点で終わる行は、次の行の台詞へ文が続く。 */
const YUME = [
  "こんな夢を見た。",
  "腕組をして枕元に坐っていると、仰向に寝た女が、静かな声でもう死にますと云う。女は長い髪を枕に敷いて、輪郭の柔らかな瓜実顔をその中に横たえている。",
  "自分は黙って首肯いた。女は静かな調子を一段張り上げて、",
  "「百年待っていて下さい」と思い切った声で云った。",
  "自分はただ待っていると答えた。すると、黒い眸のなかに鮮に見えた自分の姿が、ぼうっと崩れて来た。",
  "自分はそれから庭へ下りて、真珠貝で穴を掘った。真珠貝は大きな滑かな縁の鋭どい貝であった。土をすくうたびに、貝の裏に月の光が差してきらきらした。",
].join("\n");

describe("1 行 1 段落の文書: 段落の数え方", () => {
  it("天災と国防: 行ごとの段落として数え、長すぎる段落と言わない", () => {
    assert.deepEqual(paragraphSizes(TENSAI, ja), [2, 3, 3, 2]);
    assert.ok(!findingsOf(TENSAI, ja).includes("max-paragraph-length"));
  });

  it("夢十夜: 読点で終わる行と次の台詞は 1 文のまま、1 つの段落に残る", () => {
    const doc = buildDocument("t.md", YUME, ja);
    const across = doc.sentences.find((sentence) => sentence.text.includes("張り上げて"));
    assert.ok(across !== undefined && across.text.includes("思い切った声で云った"));
    const holding = doc.paragraphs.find((paragraph) => paragraph.sentences.includes(across));
    assert.ok(holding !== undefined);
    assert.ok(YUME.slice(holding.span.start, holding.span.end).startsWith("自分は黙って首肯いた。"));
  });

  it("議事録: 発言者の行は、続く発言と同じ段落に入る", () => {
    const minutes = [
      "○事務局",
      "では、これより委員会を開催いたします。委員の皆様、ありがとうございます。",
      "本日は、どうぞよろしくお願いいたします。",
      "資料は事前にお送りしております。御確認をお願いいたします。",
      "○委員長",
      "承知しました。それでは議事に入ります。",
      "まず資料１を御覧ください。事務局から説明をお願いします。",
      "○委員",
      "資料について質問があります。",
      "一点目は日程です。二点目は費用です。",
    ].join("\n");
    const doc = buildDocument("t.md", minutes, ja);
    const first = doc.paragraphs[0];
    assert.ok(first !== undefined && minutes.slice(first.span.start, first.span.end).startsWith("○事務局\nでは、"));
    assert.ok(doc.paragraphs.length > 1);
  });

  it("割っても文の数は変わらない", () => {
    [TENSAI, YUME].forEach((text) => {
      const doc = buildDocument("t.md", text, ja);
      assert.equal(
        doc.paragraphs.reduce((sum, paragraph) => sum + paragraph.sentences.length, 0),
        doc.sentences.length,
      );
    });
  });

  it("1 行 1 文で書いた長い段落は、これまでどおり長すぎると言う", () => {
    const text = Array.from({ length: 8 }, (_, index) => `これは${String(index)}番目の文です。`).join("\n");
    assert.ok(findingsOf(`# 見出し\n\n${text}`, ja).includes("max-paragraph-length"));
  });

  it("英語: 固定幅で折り返した段落は 1 つのまま", () => {
    const wrapped = [
      "The committee met on Tuesday to review the budget. Members raised",
      "concerns about the timeline and asked for a revised plan. The chair",
      "agreed to circulate a draft before the next meeting. A vote was",
      "deferred until then.",
    ].join("\n");
    assert.deepEqual(paragraphSizes(wrapped, en), [4]);
  });

  it("英語: 1 行 1 文で書いた段落は 1 つのまま", () => {
    const semantic = ["The committee met on Tuesday.", "Members raised concerns.", "The chair agreed to a draft.", "A vote was deferred."].join("\n");
    assert.deepEqual(paragraphSizes(semantic, en), [4]);
  });

  it("英語: 1 行 1 文の段落に 2 文の行が 2 つ混じっても 1 つのまま", () => {
    const semantic = [
      "If you made a mistake, apologize as soon as possible.",
      "Saying sorry is a sign of strength. It is not weakness.",
      "The people who do the most work will make the most mistakes.",
      "When we share our mistakes, others can learn from us. The same mistake is then less likely.",
    ].join("\n");
    assert.deepEqual(paragraphSizes(semantic, en), [6]);
  });

  it("英語: 1 行 1 段落で書いた段落は行で割る", () => {
    const lines = [
      "The committee met on Tuesday. Members raised concerns about the timeline.",
      "The chair agreed to circulate a draft. It will arrive before the next meeting.",
      "A vote was deferred. Nobody objected.",
    ].join("\n");
    assert.deepEqual(paragraphSizes(lines, en), [2, 2, 2]);
  });
});
