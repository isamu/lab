import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { clauseEnds, determinerParticles, longestClausePart } from "../packages/chaff/src/clause-particles.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { namedRuleRun } from "./rule-run.ts";

// no-doubled-joshi: 節の主語を示す「の」（番号のついた版）、「との間」の「の」、「他の」の「の」は、名詞を名詞の中に入れる「の」ではない。例文は自作。

const chains = (body: string): readonly string[] => namedRuleRun("no-doubled-joshi", `# 報告\n\n${body}\n`, ja, "a.md", "business/report").findings;

type Piece = readonly [surface: string, pos?: string, lemma?: string];

const tokensOf = (...pieces: Piece[]): Token[] =>
  pieces.reduce<Token[]>((tokens, [surface, pos, lemma]) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    return [...tokens, { surface, pos: pos ?? (surface === "の" ? "ADP" : "NOUN"), lemma: lemma ?? surface, span: { start, end: start + surface.length } }];
  }, []);

describe("clauseEnds", () => {
  it("「の」のすぐ後ろの、辞書の形の動詞と助動詞の付いた動詞", () => {
    const helped = tokensOf(["番号"], ["の"], ["つい", "VERB", "つく"], ["た", "AUX"], ["版"]);
    assert.deepEqual([...clauseEnds(helped, ["の"])], [helped[2]]);
    const plain = tokensOf(["大臣"], ["の"], ["定める", "VERB"], ["基準"]);
    assert.deepEqual([...clauseEnds(plain, ["の"])], [plain[2]]);
  });

  it("名詞を作る動詞の形、「の」の後ろでない動詞、離れた動詞、空の文は切らない", () => {
    assert.equal(clauseEnds(tokensOf(["年金"], ["の"], ["繰下げ", "VERB", "繰下げる"], ["受給"]), ["の"]).size, 0);
    assert.equal(clauseEnds(tokensOf(["番号"], ["が"], ["つい", "VERB", "つく"], ["た", "AUX"]), ["の"]).size, 0);
    const gap: Token[] = [
      { surface: "の", pos: "ADP", span: { start: 0, end: 1 } },
      { surface: "ある", pos: "VERB", lemma: "ある", span: { start: 2, end: 4 } },
    ];
    assert.equal(clauseEnds(gap, ["の"]).size, 0);
    assert.equal(clauseEnds(tokensOf(["ある", "VERB"]), ["の"]).size, 0);
    assert.equal(clauseEnds([], ["の"]).size, 0);
  });
});

describe("longestClausePart", () => {
  it("節の終わりで区切った、いちばん長い助詞の並び", () => {
    const tokens = tokensOf(["特定"], ["の"], ["番号"], ["の"], ["つい", "VERB", "つく"], ["た", "AUX"], ["版"], ["の"], ["部品"]);
    const run = [tokens[1], tokens[3], tokens[7]].filter((token) => token !== undefined);
    assert.equal(longestClausePart(run, clauseEnds(tokens, ["の"])), 2);
    assert.equal(longestClausePart(run, new Set()), 3);
  });

  it("空の並び", () => {
    assert.equal(longestClausePart([], new Set()), 0);
  });
});

describe("determinerParticles", () => {
  it("語のすぐ後ろの数える助詞だけ", () => {
    const tokens = tokensOf(["他"], ["の"], ["項目"], ["の"], ["代わり"]);
    assert.deepEqual([...determinerParticles(tokens, ["の"], ["他"])], [tokens[1]]);
  });

  it("ほかの語、数えない助詞、文の頭の助詞、空の文は数えたまま", () => {
    assert.equal(determinerParticles(tokensOf(["全て"], ["の"], ["項目"]), ["の"], ["他"]).size, 0);
    assert.equal(determinerParticles(tokensOf(["他"], ["が", "ADP"]), ["の"], ["他"]).size, 0);
    assert.equal(determinerParticles(tokensOf(["の"], ["項目"]), ["の"], ["他"]).size, 0);
    assert.equal(determinerParticles([], ["の"], ["他"]).size, 0);
  });
});

describe("no-doubled-joshi: 節の主語の「の」、「との間」、「他の」", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「の」で主語を示した節の前と後ろが、どちらも上限までなら言わない", () => {
    assert.deepEqual(chains("特定の番号のついた版の部品を使います。"), []);
  });

  it("節のどちらかで上限を超えれば、連なり全体を言う", () => {
    assert.deepEqual(chains("障害のある生徒の学校の教科の改善です。"), ["「の」が読点を挟まずに 4 回続いています（2 回まで）"]);
  });

  it("「との間」の「の」を連なりに数えない", () => {
    assert.deepEqual(chains("利用者と窓口との間のやりとりの例です。"), []);
  });

  it("「他の」の「の」を連なりに数えない", () => {
    assert.deepEqual(chains("他のすべての項目の代わりになります。"), []);
  });

  it("ほかの「の」の連なりは今までどおり言う", () => {
    assert.equal(chains("テーブルの上等の高さのある場所に寝かせない。").length, 1);
    assert.equal(chains("本社の営業部の第二課の方針を確認しました。").length, 1);
    assert.equal(chains("年金の繰下げ受給の上限年齢の引上げを決めました。").length, 1);
    assert.equal(chains("資料のすべての項目の確認の結果です。").length, 1);
    assert.equal(chains("利用者と窓口との間の通信の記録の保存です。").length, 1);
  });
});
