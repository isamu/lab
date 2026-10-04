import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { correctionIn, editBetween } from "../packages/chaff/src/correction-edit.ts";
import { buildDocument, type TeamRules } from "../packages/chaff/src/document.ts";
import { knownCorrection } from "../packages/chaff/src/detectors/known-correction.ts";

// 誤りと正しい形の組の語彙表（known-misspelling、misconversion）。例文はすべて自作。

const misspelt = (source: string, adapter = ja): readonly string[] => namedRuleRun("known-misspelling", `${source}\n`, adapter).findings;
const misconverted = (source: string): readonly string[] => namedRuleRun("misconversion", `${source}\n`, ja).findings;

describe("known-misspelling: よくある書き誤り", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("カタカナ語と仮名の書き誤りを、正しい形を添えて指す", () => {
    assert.deepEqual(misspelt("来週、シュミレーションの結果を共有します。"), ["「シュミレーション」は「シミュレーション」の書き誤りです"]);
    assert.deepEqual(misspelt("以下のとうり進めます。"), ["「のとうり」は「のとおり」の書き誤りです"]);
    assert.deepEqual(misspelt("そうゆうことです。"), ["「そうゆう」は「そういう」の書き誤りです"]);
  });

  it("文末の打ち重ねは指し、語の途中の同じ字の並びは指さない", () => {
    assert.deepEqual(misspelt("必要ですす。"), ["「ですす」は「です」の書き誤りです"]);
    assert.deepEqual(misspelt("必要ですすべての人に配ります。"), []);
    assert.deepEqual(misspelt("明日やりますす。"), ["「ますす」は「ます」の書き誤りです"]);
    assert.deepEqual(misspelt("来週、シミュレーションの結果を共有します。"), []);
  });

  it("English: a whole word only, with the capital kept", () => {
    assert.deepEqual(misspelt("The two reports are seperate documents.", en), ['"seperate" is a misspelling of "separate"']);
    assert.deepEqual(misspelt("Teh results are in.", en), ['"Teh" is a misspelling of "The"']);
    assert.deepEqual(misspelt("It took alot of time.", en), ['"alot" is a misspelling of "a lot"']);
    assert.deepEqual(misspelt("TEH RESULTS ARE IN.", en), ['"TEH" is a misspelling of "THE"']);
    assert.deepEqual(misspelt("We visited Tehran last year.", en), []);
    assert.deepEqual(misspelt("Run `seperate` from the shell.", en), []);
  });

  it("English: more common misspellings, and the spelling itself is left alone", () => {
    assert.deepEqual(misspelt("We plan to aquire the license.", en), ['"aquire" is a misspelling of "acquire"']);
    assert.deepEqual(misspelt("The commitee meets on Monday.", en), ['"commitee" is a misspelling of "committee"']);
    assert.deepEqual(misspelt("Wich option did you pick?", en), ['"Wich" is a misspelling of "Which"']);
    assert.deepEqual(misspelt("We plan to acquire the license. The committee meets on Monday. Which option did you pick?", en), []);
  });

  it("ずらい・ずく・おえない の書き誤りを指し、正しい形と別の語は指さない", () => {
    assert.deepEqual(misspelt("この書類は書きずらいです。"), ["「書きずらい」は「書きづらい」の書き誤りです"]);
    assert.deepEqual(misspelt("会議はまだつずく。"), ["「つずく」は「つづく」の書き誤りです"]);
    assert.deepEqual(misspelt("やむおえず中止しました。"), ["「やむおえず」は「やむをえず」の書き誤りです"]);
    assert.deepEqual(misspelt("この書類は書きづらいです。会議はまだつづく。やむをえず中止しました。"), []);
    assert.deepEqual(misspelt("ビックカメラで買ったバックパックを使う。"), []);
  });
});

describe("misconversion: 変換の誤り", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("前後の語で決まる取り違えを、違う語だけ指す", () => {
    assert.deepEqual(misconverted("設定は以外と簡単でした。"), ["「以外」は「意外」の変換の誤りです"]);
    assert.deepEqual(misconverted("参加者は以外と多かった。"), ["「以外」は「意外」の変換の誤りです"]);
    assert.deepEqual(misconverted("始めて会った人にも分かるように書きます。"), ["「始めて」は「初めて」の変換の誤りです"]);
    assert.deepEqual(misconverted("雨が降る確立が高かった。"), ["「確立」は「確率」の変換の誤りです"]);
    assert.deepEqual(misconverted("新しい制度を確率した。"), ["「確率」は「確立」の変換の誤りです"]);
  });

  it("それ自体が誤りの形", () => {
    assert.deepEqual(misconverted("この部品は不可決です。"), ["「不可決」は「不可欠」の変換の誤りです"]);
    assert.deepEqual(misconverted("まさに危機一発でした。"), ["「危機一発」は「危機一髪」の変換の誤りです"]);
  });

  it("前後の語で決まる取り違えと、それ自体が誤りの形をさらに指す", () => {
    assert.deepEqual(misconverted("彼とは気が会うので、よく話す。"), ["「気が会う」は「気が合う」の変換の誤りです"]);
    assert.deepEqual(misconverted("議論は収集がつかなくなった。"), ["「収集」は「収拾」の変換の誤りです"]);
    assert.deepEqual(misconverted("機会学習のモデルを作る。"), ["「機会」は「機械」の変換の誤りです"]);
    assert.deepEqual(misconverted("五里夢中で手探りした。"), ["「五里夢中」は「五里霧中」の変換の誤りです"]);
  });

  it("同じ字でも、前後で正しく読める並びは指さない", () => {
    assert.deepEqual(misconverted("待っている間に会う約束をした。"), []);
    assert.deepEqual(misconverted("情報を収集する。学習の機会が増える。"), []);
    assert.deepEqual(misconverted("作業を始めまして、三日経つ。"), []);
    assert.deepEqual(misconverted("不当な利益を追及する委員会。"), []);
  });

  it("前後で決まらない形と、正しい字は指さない", () => {
    assert.deepEqual(misconverted("日本以外と比べて安い。"), []);
    assert.deepEqual(misconverted("作業を始めて三日が経ちました。"), []);
    assert.deepEqual(misconverted("制度の確立が急がれる。"), []);
    assert.deepEqual(misconverted("例えば、次の手順で進めます。"), []);
    assert.deepEqual(misconverted("設定は意外と簡単でした。"), []);
  });
});

describe("known-correction: names", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("a team name that holds the form keeps it", () => {
    const team: TeamRules = { jargon: [], requiredSections: [], names: ["黒ひげ危機一発"] };
    const lexicon = ja.lexicons["misconversion"] ?? [];
    const matched = (team?: TeamRules): unknown[] =>
      knownCorrection(buildDocument("a.md", "黒ひげ危機一発で遊んだ。\n", ja, team), { limit: 1, lexicon }).map((finding) => finding.values["matched"]);
    assert.deepEqual(matched(), ["危機一発"]);
    assert.deepEqual(matched(team), []);
  });

  it("without tokens, a Latin form is matched as a whole word only", () => {
    const lexicon = en.lexicons["known-misspelling"] ?? [];
    const matched = (source: string): unknown[] =>
      knownCorrection(buildDocument("a.md", `${source}\n`, en), { limit: 1, lexicon }).map((finding) => finding.values["matched"]);
    assert.deepEqual(matched("Teh map shows Tehran and Kateh."), ["Teh"]);
  });
});

describe("correctionIn: 書いた字のどこをどう直すか", () => {
  it("editBetween は前後の同じ字を除く", () => {
    assert.deepEqual(editBetween("以外と簡単", "意外と簡単"), { start: 0, end: 1, replacement: "意" });
    assert.deepEqual(editBetween("ですす", "です"), { start: 2, end: 3, replacement: "" });
    assert.deepEqual(editBetween("alot", "a lot"), { start: 1, end: 1, replacement: " " });
    assert.deepEqual(editBetween("teh", "the"), { start: 1, end: 3, replacement: "he" });
  });

  it("違う所を含む語の終わりまでを指し、後ろの語は言わない", () => {
    const edit = editBetween("以外と簡単", "意外と簡単");
    assert.deepEqual(correctionIn("以外と簡単", "以外と簡単", edit, [2, 3, 5]), { matched: "以外", suggestion: "意外" });
    assert.deepEqual(correctionIn("以外と簡単", "以外と簡単", edit, [5]), { matched: "以外と簡単", suggestion: "意外と簡単" });
  });

  it("活用で字が変わった後ろは、そのまま残す", () => {
    const edit = editBetween("始めて会う", "初めて会う");
    assert.deepEqual(correctionIn("始めて会っ", "始めて会う", edit, [2, 3, 5]), { matched: "始め", suggestion: "初め" });
  });

  it("頭が誤った形と違えば直さない; a capital is kept", () => {
    assert.equal(correctionIn("意外と簡単", "以外と簡単", editBetween("以外と簡単", "意外と簡単"), [5]), undefined);
    assert.deepEqual(correctionIn("Teh", "teh", editBetween("teh", "the"), [3]), { matched: "Teh", suggestion: "The" });
    assert.deepEqual(correctionIn("Alot", "alot", editBetween("alot", "a lot"), [4]), { matched: "Alot", suggestion: "A lot" });
  });

  it("足すだけの組は、少なくとも一字を指す", () => {
    assert.deepEqual(correctionIn("alot", "alot", editBetween("alot", "a lot"), [4]), { matched: "alot", suggestion: "a lot" });
    assert.deepEqual(correctionIn("ab", "ab", editBetween("ab", "xab"), [1, 2]), { matched: "a", suggestion: "xa" });
    assert.deepEqual(correctionIn("ab", "ab", editBetween("ab", "xab"), [0, 2]), { matched: "", suggestion: "x" });
  });

  it("empty and odd inputs do not throw", () => {
    assert.deepEqual(editBetween("", ""), { start: 0, end: 0, replacement: "" });
    assert.deepEqual(correctionIn("", "", editBetween("", "x"), []), { matched: "", suggestion: "x" });
  });
});
