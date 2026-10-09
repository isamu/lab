import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { expectedMinutes, marginOf, type WalkRate } from "../packages/chaff/src/structure/walk-time.ts";

// 距離と合わない徒歩の分数（walk-time-distance-mismatch）。徒歩の分数と隣の距離を、文書の速さで比べる。

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "walk-time-distance-mismatch": "normal" }, false, "business/press-release")
    .findings.filter((finding) => finding.rule === "walk-time-distance-mismatch")
    .map((finding) => `${String(finding.values["minutes"])}|${String(finding.values["distance"])}|${String(finding.values["expected"])}`);

const walkJa = (...paragraphs: string[]): string[] => findings(paragraphs.join("\n\n"), ja, "ja");
const walkEn = (...paragraphs: string[]): string[] => findings(paragraphs.join("\n\n"), en, "en");

const EN_RATE = "Walking times assume 80 m per minute along the road, rounded up to the next minute.";

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("expectedMinutes and marginOf", () => {
  const up: WalkRate = { metresPerMinute: 80, rounding: "up" };
  const any: WalkRate = { metresPerMinute: 80, rounding: "any" };

  it("rounds a part minute up: 400 m is 5 minutes, 401 m is 6, 200 m is 3", () => {
    assert.deepEqual(expectedMinutes({ metres: 400, margin: 0 }, up), { low: 5, high: 5 });
    assert.deepEqual(expectedMinutes({ metres: 401, margin: 0 }, up), { low: 6, high: 6 });
    assert.deepEqual(expectedMinutes({ metres: 200, margin: 0 }, up), { low: 3, high: 3 });
  });

  it("widens by the margin of the last written digit: 1.2 km is 15 to 16 minutes, about 600 m is 7 to 9", () => {
    assert.deepEqual(expectedMinutes({ metres: 1200, margin: 50 }, up), { low: 15, high: 16 });
    assert.deepEqual(expectedMinutes({ metres: 600, margin: 50 }, up), { low: 7, high: 9 });
  });

  it("accepts rounding down when the rate does not say it rounds up", () => {
    assert.deepEqual(expectedMinutes({ metres: 200, margin: 0 }, any), { low: 2, high: 3 });
  });

  it("takes the margin from the written digits: decimals by their last place, approximate integers by their last non-zero digit", () => {
    assert.equal(marginOf("1.2", false), 0.05);
    assert.equal(marginOf("1.2", true), 0.05);
    assert.equal(marginOf("400", false), 0);
    assert.equal(marginOf("600", true), 50);
    assert.equal(marginOf("250", true), 5);
    assert.equal(marginOf("1,200", true), 50);
  });
});

describe("walk-time-distance-mismatch (ja)", () => {
  it("reports minutes that do not match the distance beside them at 80 m a minute", () => {
    assert.deepEqual(walkJa("| 交通 | あおば線「青葉台」駅 徒歩3分（約600m） |"), ["徒歩3分|600m|7–9"]);
    assert.deepEqual(walkJa("「みどり台」駅 徒歩3分（800m）"), ["徒歩3分|800m|10"]);
    assert.deepEqual(walkJa("駅 徒歩5分（約1.2km）"), ["徒歩5分|1.2km|15–16"]);
  });

  it("does not report minutes that match, rounded up, or within the width of an approximate distance", () => {
    assert.deepEqual(walkJa("駅徒歩5分（400m）"), []);
    assert.deepEqual(walkJa("駅 徒歩15分（約1.2km）"), []);
    assert.deepEqual(walkJa("駅 徒歩3分（約200m）"), []);
    assert.deepEqual(walkJa("駅 徒歩16分（1.2km）"), []);
  });

  it("reads full-width digits, ㎞, a distance written before the minutes, and 徒歩で", () => {
    assert.deepEqual(walkJa("駅 徒歩３分（８００ｍ）"), ["徒歩３分|８００ｍ|10"]);
    assert.deepEqual(walkJa("駅まで1.2㎞（徒歩5分）"), ["徒歩5分|1.2㎞|15–16"]);
    assert.deepEqual(walkJa("駅まで徒歩で3分（800m）"), ["徒歩で3分|800m|10"]);
  });

  it("pairs each station on one line with its own distance", () => {
    assert.deepEqual(walkJa("A駅 徒歩5分（400m）、B駅 徒歩3分（800m）"), ["徒歩3分|800m|10"]);
    assert.deepEqual(walkJa("A駅 徒歩5分（400m）、B駅 徒歩10分（800m）"), []);
  });

  it("uses the rate the document states instead of 80 m", () => {
    assert.deepEqual(walkJa("駅 徒歩5分（400m）", "※徒歩の分数は、道路距離60mを1分として計算し、端数は切り上げています。"), ["徒歩5分|400m|7"]);
    assert.deepEqual(walkJa("駅 徒歩7分（400m）", "※徒歩の分数は、分速60mで計算しています。"), []);
    assert.deepEqual(walkJa("駅 徒歩2分（200m）", "徒歩の分数は80mを1分として計算し、端数は切り上げません。"), []);
  });

  it("does not compare missing distances, ranges, limits, approximate minutes, other transport or areas", () => {
    assert.deepEqual(walkJa("駅 徒歩3分"), []);
    assert.deepEqual(walkJa("駅 徒歩5〜7分（800m）"), []);
    assert.deepEqual(walkJa("駅 徒歩3分（400〜800m）"), []);
    assert.deepEqual(walkJa("駅 徒歩10分以内（2km）"), []);
    assert.deepEqual(walkJa("駅 徒歩約3分（800m）"), []);
    assert.deepEqual(walkJa("駅からバスで3分（800m）"), []);
    assert.deepEqual(walkJa("徒歩3分、専有面積52.80㎡"), []);
    assert.deepEqual(walkJa("駅 徒歩3分、前面道路の幅は6m"), []);
    assert.deepEqual(walkJa("標高600m、徒歩3分の高原散策です。"), []);
    assert.deepEqual(walkJa("駅 徒歩5分から10分（800m）"), []);
  });

  it("does not compare when the document states two different rates", () => {
    assert.deepEqual(walkJa("駅 徒歩3分（800m）", "徒歩は分速80mで計算。", "高齢者の徒歩は分速60mで計算。"), []);
  });
});

describe("walk-time-distance-mismatch (en)", () => {
  it("reports minutes that do not match the distance at the rate the document states", () => {
    assert.deepEqual(walkEn("| Access | Ashford Station, a 3-minute walk (600 m) |", EN_RATE), ["3-minute walk|600 m|8"]);
    assert.deepEqual(walkEn("Fernhill Station, a 5-minute walk (1.2 km)", EN_RATE), ["5-minute walk|1.2 km|15–16"]);
    assert.deepEqual(walkEn("The park is 10 minutes on foot (2 km).", "Walking times are at 5 km/h."), ["10 minutes on foot|2 km|24"]);
  });

  it("assumes no rate: without one stated, nothing is compared", () => {
    assert.deepEqual(walkEn("Ashford Station, a 3-minute walk (600 m)"), []);
  });

  it("does not report matching minutes, and accepts rounding down when the rate line does not say rounded up", () => {
    assert.deepEqual(walkEn("Ashford Station, a 3-minute walk (200 m)", EN_RATE), []);
    assert.deepEqual(walkEn("Ashford Station, a 2-minute walk (200 m)", "Walking times assume 80 m per minute."), []);
    assert.deepEqual(walkEn("Ashford Station, a 2-minute walk (200 m)", EN_RATE), ["2-minute walk|200 m|3"]);
    assert.deepEqual(walkEn("A 2-minute walk (200 m).", "Walking times assume 80 m per minute; fractions are not rounded up."), []);
  });

  it("does not compare limits, ranges, approximate minutes, other transport, or a distance written apart", () => {
    assert.deepEqual(walkEn("Within a 3-minute walk (600 m) of the station.", EN_RATE), []);
    assert.deepEqual(walkEn("A 3-5 minute walk (600 m).", EN_RATE), []);
    assert.deepEqual(walkEn("An 8 to 10 minute walk (600 m).", EN_RATE), []);
    assert.deepEqual(walkEn("About a 3-minute walk (600 m).", EN_RATE), []);
    assert.deepEqual(walkEn("A 3-minute drive (600 m).", EN_RATE), []);
    assert.deepEqual(walkEn("A 3-minute walk from the station, which is 600 m from the river.", EN_RATE), []);
    assert.deepEqual(walkEn("A 3-minute walk (60 m²).", EN_RATE), []);
  });
});
