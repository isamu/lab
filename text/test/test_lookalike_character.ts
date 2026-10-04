import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { lookalikesIn } from "../packages/chaff/src/detectors/lookalike-character.ts";

// 見た目が同じで別の字（lookalike-character）。例文はすべて自作。字は \u で書き、エディタで化けないようにする。

const RULE = "lookalike-character";
const KANGXI_MOUNTAIN = "\u2F2D";
const COMPAT_MUSIC = "\uF914";
const COMBINING_VOICED = "\u3099";
const SPACING_VOICED = "\u309B";
const COMBINING_ACUTE = "\u0301";

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
