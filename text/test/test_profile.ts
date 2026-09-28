import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detected, parseProfile, type ProfileDefinition } from "../packages/chaff/src/profile/parse.ts";
import { chooseProfile, NO_PROFILE, type ProfileRequest } from "../packages/chaff/src/profile/select.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";

// 文書の種類（profiles/*.yaml）。読み方と選び方。種類の中身は YAML にあり、コードは読むだけ。

// 労働基準法 第一条〜第三条（公共の著作物）。
const STATUTE = [
  "（労働条件の原則）",
  "第一条　労働条件は、労働者が人たるに値する生活を営むための必要を充たすべきものでなければならない。",
  "（労働条件の決定）",
  "第二条　労働条件は、労働者と使用者が、対等の立場において決定すべきものである。",
  "第三条　使用者は、労働者の国籍、信条又は社会的身分を理由として、差別的取扱をしてはならない。",
].join("\n");

const CONTRACT = ["第1条（目的）", "本契約は、甲乙間の売買について定める。", "第2条（定義）", "第3条（支払）"].join("\n");

const toy = (id: string, line: string, minLines = 1): ProfileDefinition => ({
  id,
  name: {},
  detect: { ja: { line, minLines } },
  languages: { ja: { id, addresses: ["X"], connectives: [] } },
});

const request = (overrides: Partial<ProfileRequest>): ProfileRequest => ({ byPath: undefined, config: undefined, source: "", language: "ja", ...overrides });

describe("parseProfile", () => {
  it("言語ごとの番地とつなぎの語、内容から選ぶ形を読む", () => {
    const definition = parseProfile({
      id: "t",
      name: { ja: "試し" },
      why: { ja: "理由" },
      detect: { ja: { line: "^A", min_lines: 2 } },
      ja: { addresses: ["A", "", 3], connectives: ["及"], address_end: "$", caption: "^（(.+)）$" },
      en: { addresses: ["B"], address_end: "", caption: "" },
    });
    assert.deepEqual(definition, {
      id: "t",
      name: { ja: "試し" },
      detect: { ja: { line: "^A", minLines: 2 } },
      languages: {
        ja: { id: "t", addresses: ["A"], connectives: ["及"], addressEnd: "$", caption: "^（(.+)）$" },
        en: { id: "t", addresses: ["B"], connectives: [], addressEnd: undefined, caption: undefined },
      },
    });
  });

  it("id の無いもの、形の違うものは読まない", () => {
    assert.equal(parseProfile({ ja: { addresses: ["A"] } }), undefined);
    assert.equal(parseProfile({ id: "" }), undefined);
    assert.equal(parseProfile("statute"), undefined);
    assert.equal(parseProfile(null), undefined);
  });

  it("min_lines が無いか正でなければ 1 行とする。line の無い detect は捨てる", () => {
    assert.deepEqual(parseProfile({ id: "t", detect: { ja: { line: "^A", min_lines: 0 }, en: { min_lines: 2 } } })?.detect, {
      ja: { line: "^A", minLines: 1 },
    });
  });
});

describe("detected", () => {
  const statute = loadProfiles().find((definition) => definition.id === "statute");
  if (statute === undefined) throw new Error("no statute profile");

  it("法令の条の行が 3 行あれば法令", () => assert.equal(detected(statute, STATUTE, "ja"), true));
  it("2 行では足りない", () => assert.equal(detected(statute, STATUTE.split("\n").slice(0, 4).join("\n"), "ja"), false));
  it("契約書の「第1条（目的）」は法令の形ではない", () => assert.equal(detected(statute, CONTRACT, "ja"), false));
  it("本文の中の「第一条　」は行頭でなければ数えない", () => assert.equal(detected(statute, "前の第一条　と第二条　と第三条　を見る。", "ja"), false));
  it("その言語の形が無ければ選ばない", () => assert.equal(detected(statute, STATUTE, "en"), false));
});

describe("chooseProfile", () => {
  const definitions = [toy("a", "^A"), toy("b", "^B")];

  it("by_path が chaff.yaml に勝ち、chaff.yaml が内容に勝つ", () => {
    assert.equal(chooseProfile(definitions, request({ byPath: "b", config: "a", source: "A" }))?.profile.id, "b");
    assert.equal(chooseProfile(definitions, request({ byPath: "b", config: "a", source: "A" }))?.from, "by-path");
    assert.equal(chooseProfile(definitions, request({ config: "b", source: "A" }))?.profile.id, "b");
    assert.equal(chooseProfile(definitions, request({ config: "b", source: "A" }))?.from, "config");
    assert.equal(chooseProfile(definitions, request({ source: "B" }))?.profile.id, "b");
    assert.equal(chooseProfile(definitions, request({ source: "B" }))?.from, "content");
  });

  it("none と書けば、内容からも選ばない", () => {
    assert.equal(chooseProfile(definitions, request({ config: NO_PROFILE, source: "A" })), undefined);
    assert.equal(chooseProfile(definitions, request({ byPath: NO_PROFILE, config: "a", source: "A" })), undefined);
  });

  it("名前で選んだ種類が無いか、その言語の中身が無ければ選ばない。内容から別の種類に替えない", () => {
    assert.equal(chooseProfile(definitions, request({ config: "missing", source: "A" })), undefined);
    assert.equal(chooseProfile(definitions, request({ config: "a", source: "A", language: "en" })), undefined);
  });

  it("どれにも当たらなければ選ばない", () => {
    assert.equal(chooseProfile(definitions, request({ source: "C" })), undefined);
    assert.equal(chooseProfile([], request({ source: "A" })), undefined);
  });
});

describe("同梱の profiles", () => {
  it("どれも読めて、id がファイル名と同じ", () => {
    const definitions = loadProfiles();
    assert.ok(definitions.length > 0);
    definitions.forEach((definition) => {
      const file = new URL(`../packages/chaff/profiles/${definition.id}.yaml`, import.meta.url);
      assert.ok(readFileSync(file, "utf8").includes(`id: ${definition.id}`));
    });
  });

  it("コーパスの日本の法令 4 本は、設定なしで法令として選ばれる", () => {
    ["kaisha", "kojin", "minpo", "rouki"].forEach((law) => {
      const source = readFileSync(new URL(`../corpus/laws/${law}.txt`, import.meta.url), "utf8");
      assert.equal(chooseProfile(loadProfiles(), request({ source }))?.profile.id, "statute", law);
    });
  });
});
