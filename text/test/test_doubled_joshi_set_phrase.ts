import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { setPhraseParticles } from "../packages/chaff/src/set-phrase-particles.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { namedRuleRun } from "./rule-run.ts";

// no-doubled-joshi: 決まった言い回し（絶滅のおそれのある種の「おそれのある」）の中の「の」は、入れ子の「の」ではない。例文は自作。

const chains = (body: string): readonly string[] => namedRuleRun("no-doubled-joshi", `# 報告\n\n${body}\n`, ja, "a.md", "business/report").findings;

type Piece = readonly [surface: string, lemma?: string];

const tokensOf = (...pieces: Piece[]): Token[] =>
  pieces.reduce<Token[]>((tokens, [surface, lemma]) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    return [...tokens, { surface, pos: surface === "の" ? "ADP" : "NOUN", lemma: lemma ?? surface, span: { start, end: start + surface.length } }];
  }, []);

describe("setPhraseParticles", () => {
  const phrases = ["おそれのある"];
  it("言い回しの中の助詞だけ。解析器が頭の語を切っても、後ろの語が活用していても", () => {
    const cut = tokensOf(["絶滅"], ["の"], ["お"], ["それ"], ["の"], ["ある"], ["種"]);
    assert.deepEqual([...setPhraseParticles(cut, ["の"], phrases)], [cut[4]]);
    const whole = tokensOf(["おそれ"], ["の"], ["あっ", "ある"], ["た"]);
    assert.deepEqual([...setPhraseParticles(whole, ["の"], phrases)], [whole[1]]);
  });

  it("言い回しでない語、間の空いた語、数えない助詞、端の助詞、空の文は数えたまま", () => {
    assert.equal(setPhraseParticles(tokensOf(["高さ"], ["の"], ["ある"]), ["の"], phrases).size, 0);
    const gap: Token[] = [
      { surface: "おそれ", pos: "NOUN", span: { start: 0, end: 3 } },
      { surface: "の", pos: "ADP", span: { start: 4, end: 5 } },
      { surface: "ある", pos: "VERB", lemma: "ある", span: { start: 5, end: 7 } },
    ];
    assert.equal(setPhraseParticles(gap, ["の"], phrases).size, 0);
    assert.equal(setPhraseParticles(tokensOf(["おそれ"], ["が"], ["ある"]), ["の"], ["おそれがある"]).size, 0);
    assert.equal(setPhraseParticles(tokensOf(["おそれ"], ["の"]), ["の"], phrases).size, 0);
    assert.equal(setPhraseParticles(tokensOf(["の"], ["ある"]), ["の"], phrases).size, 0);
    assert.equal(setPhraseParticles([], ["の"], phrases).size, 0);
  });
});

describe("no-doubled-joshi: 決まった言い回し", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「おそれのある」の「の」を連なりに数えない", () => {
    assert.deepEqual(chains("絶滅のおそれのある地域の個体群を保護しました。"), []);
  });

  it("ほかの「の」の連なりは今までどおり言う", () => {
    assert.equal(chains("テーブルの上等の高さのある場所に寝かせない。").length, 1);
    assert.equal(chains("本社の営業部の第二課の方針を確認しました。").length, 1);
    assert.equal(chains("地域の絶滅のおそれのある種の保護の計画です。").length, 1);
  });
});
