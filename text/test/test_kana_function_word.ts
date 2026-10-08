import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { runCli } from "./cli-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { inKana } from "../packages/chaff/src/detectors/kana-function-word.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { levelFor, runRules } from "../packages/chaff/src/run.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { standingIn } from "../packages/chaff/src/rule-genres.ts";

// 公用文でかなで書く補助動詞・形式名詞（kana-function-word）。style: koyobun だけで動く。例文はすべて自作。

const RULE = "kana-function-word";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

const says = (written: string, preferred: string): string => `「${written}」は公用文ではかなで「${preferred}」と書きます`;

describe("kana-function-word: 補助動詞", () => {
  it("〜て下さい・ご覧下さい・〜て下さった", () => {
    assert.deepEqual(findingsOf("資料を見て下さい。詳細はこちらをご覧下さい。先方が説明して下さった。\n"), [
      says("下さい", "ください"),
      says("下さい", "ください"),
      says("下さっ", "くださっ"),
    ]);
  });

  it("〜て頂く・〜て頂きたい・〜で頂ければ", () => {
    assert.deepEqual(findingsOf("担当者に読んで頂く。至急送って頂きたい。選んで頂ければ幸いです。\n"), [
      says("頂く", "いただく"),
      says("頂き", "いただき"),
      says("頂けれ", "いただけれ"),
    ]);
  });

  it("〜て置く", () => {
    assert.deepEqual(findingsOf("前日に書いて置きます。名簿を作って置く。\n"), [says("置き", "おき"), says("置く", "おく")]);
  });

  it("本来の意味の下さい・頂く・置く（資料を下さい、本を置いて帰る）と、分けられない〜て見るは指さない", () => {
    assert.deepEqual(findingsOf("資料を下さい。記念品を頂く。本を置いて帰る。封を開いて見る。下さる方に礼を言う。\n"), []);
  });
});

describe("kana-function-word: 形式名詞", () => {
  it("〜する事・〜の様に・〜の為・〜時は・〜時には", () => {
    assert.deepEqual(findingsOf("申請書を確認する事が必要です。次の様に書く。健康の為に走る。事故の時は連絡する。不明な時には聞く。\n"), [
      says("事", "こと"),
      says("様", "よう"),
      says("為", "ため"),
      says("時", "とき"),
      says("時", "とき"),
    ]);
  });

  it("実質の名詞（事が起きた、時が経つ）と、時点を言う「時」は指さない", () => {
    assert.deepEqual(findingsOf("事が起きた。時が経つ。年齢に達した時から適用する。会議の時に話す。田中様に送る。為替が動く。\n"), []);
  });
});

describe("kana-function-word: style のときだけ動く", () => {
  const source = "# 報告\n\n不明な点は担当者に聞いて下さい。\n";

  it("何も書かなければ、--experimental でも動かず、style のための rule だと言う", () => {
    assert.ok(!firedRules(ja, "不明な点は担当者に聞いて下さい。\n").includes(RULE));
    const rules = loadRules("ja");
    const skipped = runRules(buildDocument("a.md", "聞いて下さい。\n", ja), rules, {}, true, "business/report").skipped;
    assert.deepEqual(
      skipped.filter((entry) => entry.rule === RULE).map((entry) => entry.why),
      [REASONS.ja.optIn],
    );
    const rule = rules.find((entry) => entry.id === RULE);
    assert.ok(rule !== undefined);
    assert.deepEqual(standingIn(rule, "legal/statute", {}), { kind: "opt-in" });
    assert.equal(levelFor(rule, { [RULE]: "strict" }, false, {}), "strict");
  });

  it("style: koyobun で動き、style の無い chaff.yaml では動かない", async () => {
    const koyobun = await runCli({ "chaff.yaml": "language: ja\nstyle: koyobun\n", "a.md": source }, ["a.md", "--compact"]);
    assert.match(koyobun.out, /「下さい」は公用文ではかなで「ください」と書きます/u);
    const plain = await runCli({ "chaff.yaml": "language: ja\n", "a.md": source }, ["a.md", "--compact"]);
    assert.doesNotMatch(plain.out, /kana-function-word|公用文ではかなで/u);
  });

  it("英語の文書では動かない", () => {
    assert.deepEqual(namedRuleRun(RULE, "Please read the notes.\n", en).skipped, ["not a rule for en"]);
  });
});

describe("inKana", () => {
  const entry = (pattern: string, rewrite?: string) => ({ pattern, ...(rewrite === undefined ? {} : { rewrite }) });

  it("漢字の語幹だけをかなにし、活用した語尾は残す", () => {
    assert.equal(inKana("下さい", entry("下さる", "くださる")), "ください");
    assert.equal(inKana("頂けれ", entry("頂ける", "いただける")), "いただけれ");
    assert.equal(inKana("事", entry("事", "こと")), "こと");
  });

  it("合わない語と、書き方の無い語・送り仮名の食い違う語は undefined", () => {
    assert.equal(inKana("くださる", entry("下さる", "くださる")), undefined);
    assert.equal(inKana("下さい", entry("下さる")), undefined);
    assert.equal(inKana("下さい", entry("下さる", "くだすった")), undefined);
    assert.equal(inKana("下さい", entry("ください", "ください")), undefined);
  });
});
