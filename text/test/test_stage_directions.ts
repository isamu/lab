import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { stageDirectionPieces } from "../packages/chaff/src/stage-directions.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { parseProfile } from "../packages/chaff/src/profile/parse.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { DocumentProfile } from "../packages/chaff/src/plugin.ts";

// 戯曲（profiles/play.yaml）。ト書き（括弧の中）は台詞の文の一部ではなく、台詞と別に文に分ける。

const PAREN = { open: "（", close: "）" };

const pieces = (text: string): string[] => stageDirectionPieces(text, PAREN).map((span) => text.slice(span.start, span.end));

describe("stageDirectionPieces", () => {
  it("台詞・ト書き・台詞に分ける。括弧の字はどの片にも入れない", () => {
    assert.deepEqual(pieces("帰るよ。（立ち上がる）また明日。"), ["帰るよ。", "立ち上がる", "また明日。"]);
  });

  it("行の頭のト書きと、ト書きだけの行", () => {
    assert.deepEqual(pieces("（窓を開けて）いい風だ。"), ["窓を開けて", "いい風だ。"]);
    assert.deepEqual(pieces("（幕）"), ["幕"]);
  });

  it("入れ子の括弧は、いちばん外側の組で切る", () => {
    assert.deepEqual(pieces("（手紙（古い）を読む）そうか。"), ["手紙（古い）を読む", "そうか。"]);
  });

  it("閉じない括弧と、開いていない閉じ括弧では切らない", () => {
    assert.deepEqual(pieces("待て（まだ話は"), ["待て（まだ話は"]);
    assert.deepEqual(pieces("待て）まだ話は"), ["待て）まだ話は"]);
  });

  it("括弧が無ければ一つの片。空白だけの片は返さない", () => {
    assert.deepEqual(pieces("そうだね。"), ["そうだね。"]);
    assert.deepEqual(pieces("　（間）　"), ["間"]);
    assert.deepEqual(pieces(""), []);
    assert.deepEqual(pieces("（）"), []);
  });

  it("サロゲートペアの字があっても位置がずれない", () => {
    assert.deepEqual(pieces("𠮷田だ。（笑う）𠮷田だよ。"), ["𠮷田だ。", "笑う", "𠮷田だよ。"]);
    assert.deepEqual(stageDirectionPieces("𠮷（a）", PAREN), [
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ]);
  });
});

describe("the play profile", () => {
  const play = profileFor(EMPTY, "play.md", "", "ja", "literature/play");

  it("literature/play reads Japanese with it; other genres and English plays do not", () => {
    assert.deepEqual(play?.stageDirections, PAREN);
    ["literature/fiction", "literature/poetry", "legal/statute", "business/report"].forEach((genre) =>
      assert.equal(profileFor(EMPTY, "a.md", "", "ja", genre)?.stageDirections, undefined, genre),
    );
    assert.equal(profileFor(EMPTY, "play.md", "", "en", "literature/play"), undefined);
  });

  it("reads stage_directions only as two different single characters", () => {
    const pair = (value: unknown): unknown => parseProfile({ id: "t", ja: { stage_directions: value } })?.languages["ja"]?.stageDirections;
    assert.deepEqual(pair({ open: "［", close: "］" }), { open: "［", close: "］" });
    [{ open: "（" }, { open: "((", close: "))" }, { open: "|", close: "|" }, { open: "", close: "）" }, "（）", null].forEach((value) =>
      assert.equal(pair(value), undefined, JSON.stringify(value)),
    );
  });
});

// ト書きの 2 行は岸田國士「明日は天気」「命を弄ぶ男ふたり」（公共の著作物）。前に並べた台詞の行は書いたもの。
const SPEECH_LINES = ["夫　　なんにも云ふことはないね。", "妻　　さうですか。", "夫　　さうだよ。", "妻　　ええ。"];
const DIRECTION_WITH_SENTENCES =
  "妻　　（寝返りをうつて、夫の方に向き直る。が、これこそ、口は自然に開くに任せ、鼻の孔は、耳鼻咽喉科の診察室に於ける如く、やや、あふ向き加減に奥の方まで見通せる姿勢である）";
const DIRECTION_IN_SPEECH =
  "繃帯　　卑怯なのは君のことだ。（相手の手を振りはらつて、後ろへ廻り、腰に手をかけて土手の上に押し上げながら）愚図々々してないで、さつさと行き給へ。";

const scene = (line: string): string => [...SPEECH_LINES, line].join("\n\n");

describe("a play's sentences", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const play = (): DocumentProfile | undefined => profileFor(EMPTY, "play.md", "", "ja", "literature/play");
  const sentences = (source: string, profile: DocumentProfile | undefined): string[] =>
    buildDocument("play.md", source, ja, undefined, profile).sentences.map((sentence) => sentence.text.trim());

  it("a direction with 。 inside is sentences of its own", () => {
    const found = sentences(scene(DIRECTION_WITH_SENTENCES), play());
    assert.ok(found.includes("寝返りをうつて、夫の方に向き直る。"));
    assert.ok(found.some((sentence) => sentence.startsWith("が、これこそ")));
  });

  it("a direction inside a line is apart from the speech before and after it", () => {
    const found = sentences(scene(DIRECTION_IN_SPEECH), play());
    assert.ok(found.some((sentence) => sentence.endsWith("卑怯なのは君のことだ。")));
    assert.ok(found.includes("相手の手を振りはらつて、後ろへ廻り、腰に手をかけて土手の上に押し上げながら"));
    assert.ok(found.includes("愚図々々してないで、さつさと行き給へ。"));
  });

  it("without the profile the direction stays in the sentence (the control)", () => {
    const found = sentences(scene(DIRECTION_IN_SPEECH), undefined);
    assert.ok(found.some((sentence) => sentence.startsWith("（相手の手を") && sentence.endsWith("行き給へ。")));
  });

  it("the sentence positions are the document's own", () => {
    const doc = buildDocument("play.md", scene(DIRECTION_IN_SPEECH), ja, undefined, play());
    doc.sentences.forEach((sentence) => assert.equal(doc.source.slice(sentence.span.start, sentence.span.end), sentence.text));
  });

  const ruleFindings = (source: string, profile: DocumentProfile | undefined, rule: string): number =>
    runRules(buildDocument("play.md", source, ja, undefined, profile), loadRules("ja"), { [rule]: "normal" }, true, "literature/play").findings.filter(
      (finding) => finding.rule === rule,
    ).length;

  it("commas are counted in each sentence of a direction", () => {
    assert.ok(ruleFindings(scene(DIRECTION_WITH_SENTENCES), undefined, "max-ten") > 0);
    assert.equal(ruleFindings(scene(DIRECTION_WITH_SENTENCES), play(), "max-ten"), 0);
  });

  it("English text is not split by the profile's brackets", () => {
    const doc = buildDocument("play.md", "He waits. (He sits down.) Then he goes.", en, undefined, profileFor(EMPTY, "play.md", "", "en", "literature/play"));
    assert.ok(doc.sentences.some((sentence) => sentence.text.includes("(He sits down.)")));
  });
});
