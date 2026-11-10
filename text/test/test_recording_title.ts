import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isRecordingTitle } from "../packages/chaff/src/recording-title.ts";

// 動画の題（末尾に再生時間）と、その下の説明は動画の言葉のまま。題の長さも、説明の文末の調子も書き手のものとして見ない。例文はすべて自作。

const desumasuOf = (source: string): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", "blog/owned-media").findings;

const BODY = ["## 相談の窓口", "", "相談は無料です。", "電話でも受け付けています。", "匿名でも相談できます。", "平日の夜も開いています。", ""].join("\n");

const captioned = (heading: string): string =>
  ["# 心の健康", "", "## 動画", "", `### ${heading}`, "", "身近な人の変化に気づき、声をかけ、話を聴く。支え合う気持ちが暮らしを守ります。", "", BODY].join(
    "\n",
  );

describe("isRecordingTitle: a heading ending with its running time", () => {
  it("reads minutes and seconds, or a clock time, in brackets at the end", () => {
    ["守ろう心の健康【字幕付】（3分00秒）", "守ろう心の健康（45秒）", "Keeping well (12:30)", "守ろう心の健康（３分）"].forEach((heading) =>
      assert.equal(isRecordingTitle(heading), true, heading),
    );
  });

  it("does not read a count, a date or a time in the middle", () => {
    ["守ろう心の健康（3回目）", "会議（3分科会）の報告", "（3分00秒）の動画を作りました"].forEach((heading) =>
      assert.equal(isRecordingTitle(heading), false, heading),
    );
  });
});

describe("no-mixed-desumasu: a recording's caption", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("does not compare the caption under a recording's title with the page", () => {
    assert.deepEqual(desumasuOf(captioned("守ろう心の健康【字幕付】（3分00秒）")), []);
  });

  it("still compares the same text under an ordinary heading", () => {
    assert.equal(desumasuOf(captioned("守ろう心の健康【字幕付】")).length, 1);
  });
});
