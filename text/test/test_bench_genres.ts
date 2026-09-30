import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { BENCH_GENRES, benchGenreOf, benchLevelOf, runsInBench } from "../scripts/bench-genres.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { presetLevels } from "../packages/chaff/src/genre-load.ts";

// yarn bench が見本の種類ごとに使うジャンル。chaff に無いジャンルでは既定の設定で黙って走ってしまうので、止める。

const KNOWN = ["business/report", "legal/statute"];

describe("benchGenreOf", () => {
  it("種類に書いたジャンルが chaff にあれば、それを返す", () => {
    assert.equal(benchGenreOf("policy", { policy: "legal/statute" }, KNOWN), "legal/statute");
  });

  it("chaff に無いジャンルなら止まり、種類とジャンルを言う", () => {
    assert.throws(() => benchGenreOf("policy", { policy: "business/policy" }, KNOWN), /"policy".*"business\/policy"/u);
  });

  it("ジャンルの頭だけ（business）でも、chaff のジャンルでなければ止まる", () => {
    assert.throws(() => benchGenreOf("note", { note: "business" }, KNOWN), /"business"/u);
  });

  it("ジャンルを書いていない種類なら止まる。既定のジャンルに落とさない", () => {
    assert.throws(() => benchGenreOf("memo", { policy: "legal/statute" }, KNOWN), /"memo"/u);
    assert.throws(() => benchGenreOf("", {}, KNOWN), /""/u);
  });

  it("知っているジャンルが一つも無ければ、どの種類も止まる", () => {
    assert.throws(() => benchGenreOf("policy", { policy: "legal/statute" }, []), /legal\/statute/u);
  });
});

describe("benchLevelOf / runsInBench", () => {
  const joshi = { id: "no-doubled-joshi", use_for: ["business", "legal"] };

  it("ジャンルの preset が決めた段で走る。決めていなければ normal", () => {
    assert.equal(benchLevelOf("no-doubled-joshi", { "no-doubled-joshi": "strict" }), "strict");
    assert.equal(benchLevelOf("no-doubled-joshi", {}), "normal");
  });

  it("use_for に当たり、preset が止めていなければ走る", () => {
    assert.equal(runsInBench(joshi, "business/report", {}), true);
    assert.equal(runsInBench(joshi, "legal/statute", { "padded-intro": "off" }), true);
  });

  it("preset が off にした rule は走らない。植えても見つからないので見逃しに数えない", () => {
    assert.equal(runsInBench(joshi, "legal/statute", { "no-doubled-joshi": "off" }), false);
  });

  it("use_for に当たらなければ走らない", () => {
    assert.equal(runsInBench(joshi, "blog/tech", {}), false);
    assert.equal(runsInBench({ id: "x", use_for: [] }, "business/report", {}), false);
  });

  it("legal/statute の preset は法務の group が止めた rule を止める", () => {
    const preset = presetLevels("legal/statute");
    ["no-doubled-joshi", "closing-cliche", "padded-intro"].forEach((id) =>
      assert.equal(runsInBench({ id, use_for: ["legal"] }, "legal/statute", preset), false, id),
    );
    assert.equal(runsInBench({ id: "numbering-gap", use_for: ["legal"] }, "legal/statute", preset), true);
  });
});

describe("BENCH_GENRES", () => {
  it("どの種類も genres.yaml にあるジャンルで見る", () => {
    Object.entries(BENCH_GENRES).forEach(([kind, genre]) => assert.ok(GENRES.includes(genre), `${kind}: ${genre}`));
  });

  it("test/fixtures/bench の見本はどれも種類のジャンルがある", () => {
    const bench = join(import.meta.dirname, "fixtures", "bench");
    ["ja", "en"]
      .flatMap((language) => readdirSync(join(bench, language)).filter((file) => file.endsWith(".md")))
      .forEach((file) => assert.doesNotThrow(() => benchGenreOf(file.replace(/\.md$/u, ""), BENCH_GENRES, GENRES), file));
  });
});
