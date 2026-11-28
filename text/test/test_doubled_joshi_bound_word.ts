import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { boundWordParticles } from "../packages/chaff/src/bound-word-particles.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// no-doubled-joshi: 「国民の皆様」「ラックの下」の「の」は、一つの呼び方や場所の名前の中にあり、入れ子の「の」ではない。例文は自作。

const RULES = loadRules("ja");

const chains = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn("speech/address"), true, "speech/address")
    .findings.filter((finding) => finding.rule === "no-doubled-joshi")
    .map((finding) => `${String(finding.values?.["word"])}×${String(finding.values?.["count"])}`);

const tokensOf = (...surfaces: string[]): Token[] =>
  surfaces.reduce<Token[]>((tokens, surface) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    return [...tokens, { surface, span: { start, end: start + surface.length }, pos: surface === "の" ? "ADP" : "NOUN" }];
  }, []);

describe("boundWordParticles", () => {
  const groups = ["皆様", "方々"];
  it("敬って呼ぶ語のすぐ前の助詞で、呼び方が同じ助詞で次に係るものだけ", () => {
    const tokens = tokensOf("国民", "の", "皆様", "の", "期待");
    assert.deepEqual([...boundWordParticles(tokens, ["の"], groups)], [tokens[1]]);
  });

  it("呼ぶ語が無いか、間が空くか、数える助詞でないか、呼び方で連なりが終われば空", () => {
    assert.equal(boundWordParticles(tokensOf("弊社", "の", "計画"), ["の"], groups).size, 0);
    const gap: Token[] = [
      { surface: "の", span: { start: 0, end: 1 }, pos: "ADP" },
      { surface: "皆様", span: { start: 2, end: 4 }, pos: "NOUN" },
    ];
    assert.equal(boundWordParticles(gap, ["の"], groups).size, 0);
    assert.equal(boundWordParticles(tokensOf("国民", "が", "皆様"), ["の"], groups).size, 0);
    assert.equal(boundWordParticles(tokensOf("国民", "の", "皆様", "が"), ["の"], groups).size, 0);
    assert.equal(boundWordParticles(tokensOf("国民", "の", "皆様"), ["の"], groups).size, 0);
    assert.equal(boundWordParticles([], ["の"], groups).size, 0);
  });
});

describe("no-doubled-joshi: 敬って呼ぶ語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 国民の皆様の期待、市民の皆様の不断の努力", () => {
    assert.deepEqual(chains("災害派遣活動への国民の皆様の期待と感謝は大きい。\n"), []);
    assert.deepEqual(chains("市民の皆様の不断のご努力により築かれた。\n"), []);
  });

  it("invalid: 呼び方を一つと数えても続く入れ子、呼び方で終わる入れ子、呼ぶ語の無い入れ子", () => {
    assert.deepEqual(chains("会員の皆様の会社の役員の名簿を集める。\n"), ["の×3"]);
    assert.deepEqual(chains("弊社の新製品の販売の計画を立てる。\n"), ["の×3"]);
    assert.deepEqual(chains("それ以外の全ての会員の皆様が集まる。\n"), ["の×3"]);
  });
});

describe("no-doubled-joshi: 置き場所を言う語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: ラックの下の段、棚の上の箱", () => {
    assert.deepEqual(chains("ルーターは金属のラックの下の段に置いてあった。\n"), []);
    assert.deepEqual(chains("台所の棚の上の箱を下ろす。\n"), []);
  });

  it("invalid: 場所の名前を一つと数えても続く入れ子、場所の語で終わる入れ子", () => {
    assert.deepEqual(chains("本社の倉庫の棚の上の箱の鍵を探す。\n"), ["の×4"]);
    assert.deepEqual(chains("本社の営業部の倉庫の裏に置く。\n"), ["の×3"]);
  });
});

describe("no-doubled-joshi: 範囲を言う「中」", () => {
  it("invalid: 修士課程の中の一類型は数える", () => {
    assert.deepEqual(chains("大学院の修士課程の中の一類型として位置付ける。\n"), ["の×3"]);
  });
});
