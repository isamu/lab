import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isShownExample, lookalikesIn } from "../packages/chaff/src/detectors/lookalike-character.ts";

// 見た目が同じで別の字（lookalike-character）。例文はすべて自作。字は \u で書き、エディタで化けないようにする。

const RULE = "lookalike-character";
const KANGXI_MOUNTAIN = "\u2F2D";
const COMPAT_MUSIC = "\uF914";
const COMBINING_VOICED = "\u3099";
const SPACING_VOICED = "\u309B";
const COMBINING_ACUTE = "\u0301";
const SPACING_SEMI_VOICED = "\u309C";
const FULLWIDTH_HYPHEN = "\uFF0D";
const MINUS = "\u2212";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("lookalike-character: 見た目が同じで別の字", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("部首の字、互換漢字、分かれた濁点を、ふつうの字と一緒に言う", () => {
    assert.deepEqual(findingsOf(`総務課の${KANGXI_MOUNTAIN}田さんへ送ってください。`), [
      `「${KANGXI_MOUNTAIN}」（U+2F2D）は部首の字です。ふつうの「山」と書きます`,
    ]);
    assert.deepEqual(findingsOf(`音${COMPAT_MUSIC}の会を開きます。`), [`「${COMPAT_MUSIC}」（U+F914）は互換漢字です。ふつうの「樂」と書きます`]);
    assert.deepEqual(findingsOf(`か${COMBINING_VOICED}いしゃに送ります。`), [
      `「か${COMBINING_VOICED}」は字と記号が分かれています（U+304B U+3099）。一字の「が」と書きます`,
    ]);
    assert.deepEqual(findingsOf(`か${SPACING_VOICED}いしゃに送ります。`), [
      `「か${SPACING_VOICED}」は濁点・半濁点を別の字で書いています（U+304B U+309B）。一字の「が」と書きます`,
    ]);
  });

  it("reports a decomposed accent in English", () => {
    assert.deepEqual(findingsOf(`Send it to the cafe${COMBINING_ACUTE} office.`, en), [
      `"e${COMBINING_ACUTE}" is a letter and a separate mark (U+0065 U+0301), not the single letter "é"`,
    ]);
  });

  it("ふつうの字、一字にまとまらない組み合わせ、Unicode が別に持つ互換漢字は言わない", () => {
    assert.deepEqual(findingsOf("総務課の山田さんへ、が、ぱ、café を送ります。"), []);
    assert.deepEqual(lookalikesIn("葛\u{E0100}城"), []);
    assert.deepEqual(lookalikesIn("x̣̂"), []);
    assert.deepEqual(lookalikesIn("髙﨑"), []);
    assert.deepEqual(lookalikesIn("👍️"), []);
    assert.deepEqual(lookalikesIn(""), []);
  });

  it("字そのものを話題にした行（濁点・NFD・部首を名指す）の例は言わない", () => {
    assert.deepEqual(findingsOf(`- ホ${SPACING_SEMI_VOICED}ケット エンシ${SPACING_VOICED}ン のような、コピーで出る濁点のチェック`), []);
    assert.deepEqual(
      findingsOf(`\`\`\`js\n// ホ${SPACING_SEMI_VOICED}ケット エンシ${SPACING_VOICED}ン\n// のような、コピーで出る濁点のチェック\n"no-nfd": true\n\`\`\``),
      [],
    );
    assert.deepEqual(findingsOf(`部首の字 ${KANGXI_MOUNTAIN} は検索に掛かりません。`), []);
    assert.deepEqual(findingsOf(`Text pasted from a Mac may hold cafe${COMBINING_ACUTE}, the nfd form.`, en), []);
  });

  it("話題の語が離れた行にあれば、例ではなく打ち間違いとして言う", () => {
    assert.equal(findingsOf(`濁点の説明です。\n\n次の行です。\n\nか${SPACING_VOICED}いしゃに送ります。`).length, 1);
    assert.equal(findingsOf(`Send it to the cafe${COMBINING_ACUTE} office.\n\nThe menu is attached.\n\nWe avoid decomposed letters.`, en).length, 1);
  });

  it("isShownExample: 前・同じ・後ろの行だけを見る。文書の端の行、空の語彙", () => {
    const text = "a\nNFD here\nX\nb\nc";
    const x = { start: text.indexOf("X"), end: text.indexOf("X") + 1 };
    assert.equal(isShownExample(text, x, ["nfd"]), true);
    assert.equal(isShownExample(text, x, ["c"]), false);
    assert.equal(isShownExample("X", { start: 0, end: 1 }, ["x"]), true);
    assert.equal(isShownExample("X\nnfd", { start: 0, end: 1 }, ["NFD"]), true);
    assert.equal(isShownExample("nfd\nX", { start: 4, end: 5 }, ["NFD"]), true);
    assert.equal(isShownExample(text, x, []), false);
  });

  it("互換漢字の補助面も読み、位置は UTF-16 で数える", () => {
    assert.deepEqual(
      lookalikesIn("A\u{2F800}B").map((found) => [found.kind, found.usual, found.span.start, found.span.end]),
      [["compatibility", "\u4E3D", 1, 3]],
    );
  });

  it("位置は字の始まり", () => {
    const [found] = lookalikesIn(`山と${KANGXI_MOUNTAIN}`);
    assert.equal(found?.span.start, 2);
    assert.equal(found?.kind, "radical");
  });
});

describe("lookalike-character: カタカナの長音の代わりのダッシュ", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("カタカナに挟まれた全角ハイフンやマイナスを、長音の「ー」と一緒に言う", () => {
    assert.deepEqual(findingsOf(`初中教育ニュ${FULLWIDTH_HYPHEN}スをお届けします。`), [
      `「${FULLWIDTH_HYPHEN}」（U+FF0D）はダッシュの字です。カタカナの長音は「ー」と書きます`,
    ]);
    assert.deepEqual(
      lookalikesIn(`メ${FULLWIDTH_HYPHEN}ルマガジンとグル${MINUS}プ`).map((found) => [found.kind, found.written, found.usual]),
      [
        ["dash", FULLWIDTH_HYPHEN, "ー"],
        ["dash", MINUS, "ー"],
      ],
    );
  });

  it("半角のハイフン、仮名に挟まれないダッシュ、ン・ッの後、長音そのものは言わない", () => {
    assert.deepEqual(lookalikesIn("<ハッシュアルゴリズム>-<ハッシュ値>、ァ-ヶ"), []);
    assert.deepEqual(lookalikesIn(`5${FULLWIDTH_HYPHEN}1${FULLWIDTH_HYPHEN}1、ページ${FULLWIDTH_HYPHEN}3、A${FULLWIDTH_HYPHEN}ク`), []);
    assert.deepEqual(lookalikesIn(`ロン${FULLWIDTH_HYPHEN}ドン、ザッ${FULLWIDTH_HYPHEN}ク`), []);
    assert.deepEqual(lookalikesIn("ニュース、メールマガジン"), []);
  });

  it("長音を話題にした行の例は言わない", () => {
    assert.deepEqual(findingsOf(`長音を ${FULLWIDTH_HYPHEN} で書いた「ニュ${FULLWIDTH_HYPHEN}ス」は検索に掛かりません。`), []);
  });
});
