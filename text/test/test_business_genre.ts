import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type RunResult } from "../packages/chaff/src/run.ts";
import { planSemantic, semanticNeeds } from "../packages/chaff/src/run-semantic.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

/** 水増しの書き出し、逃げの表現、動作主の無い受け身、繰り返すだけのまとめを持つ報告書。書いた人が引用を許したもの。 */
const PADDED_REPORT = `# 9月の問い合わせ対応についての報告

## 背景

近年、お客様からの問い合わせはますます多様化しており、私たちサポートチームとしてもその変化にしっかりと対応していくことが求められているという状況であると考えられます。

## 9月の状況

9月の問い合わせは 412 件で、8月の 356 件から増えました。**特に**、請求に関する問い合わせが **大きく** 増えており、その多くは新しい料金プランへの切り替えに伴って、請求書の見方が分からないというものであったため、対応に時間がかかる場面が多く見られました。

一次回答までの時間は平均 6.2 時間で、目標の 4 時間を超えました。

## 対応

請求の問い合わせについて、よくある質問のページを更新することが検討されています。また、担当者の増員についても検討を進めることが必要であると考えられます。

## まとめ

以上のように、9月は問い合わせが増え、一次回答までの時間も目標を超えました。今後も引き続き改善に努めてまいります。
`;

const run = (source: string, genre: string, experimental = false): RunResult =>
  runRules(buildDocument("report.md", source, ja), loadRules("ja"), {}, experimental, genre);

const firedIn = (result: RunResult, rule: string): number[] => result.findings.filter((finding) => finding.rule === rule).map((finding) => finding.line);
const whyNotRun = (result: RunResult, rule: string): string | undefined => result.skipped.find((entry) => entry.rule === rule)?.why;

describe("business/report で既定の検査が弱くならない", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("水増しの書き出しを --experimental なしで指摘する", () => {
    assert.deepEqual(firedIn(run(PADDED_REPORT, "business/report"), "padded-intro"), [5]);
  });

  it("提案書でも指摘する", () => {
    assert.deepEqual(firedIn(run(PADDED_REPORT, "business/proposal"), "padded-intro"), [5]);
  });

  it("プレスリリース・メール・議事録では書き出しを見ない", () => {
    // 告知の「昨今の人件費の上昇のため」は値上げの理由で、書き出しの水増しではない。
    ["business/press-release", "business/email", "business/meeting-notes"].forEach((genre) => {
      const result = run(PADDED_REPORT, genre);
      assert.deepEqual(firedIn(result, "padded-intro"), [], genre);
      assert.equal(whyNotRun(result, "padded-intro"), REASONS.ja.presetOff(genre), genre);
    });
  });

  it("試験中の rule は、動いていない理由とともに一覧に残る", () => {
    const result = run(PADDED_REPORT, "business/report");
    ["agentless-passive", "excessive-hedging"].forEach((rule) => assert.equal(whyNotRun(result, rule), REASONS.ja.experimental, rule));
  });

  it("まとめの検査は、意味を読む検査として一覧に載る", () => {
    ["business/report", "business/proposal"].forEach((genre) =>
      assert.equal(whyNotRun(run(PADDED_REPORT, genre), "empty-conclusion"), REASONS.ja.semantic, genre),
    );
  });

  it("--experimental なら、1 つの文に重ねた逃げの表現を指摘する。逃げが 1 つの文は指摘しない", () => {
    assert.deepEqual(firedIn(run(PADDED_REPORT, "business/report", true), "excessive-hedging"), [5]);
  });

  it("--experimental なら動作主の無い受け身も指摘する", () => {
    assert.deepEqual(firedIn(run(PADDED_REPORT, "business/report", true), "agentless-passive"), [15]);
  });
});

describe("chaff test は報告書と提案書の結びを見る", () => {
  const closingOnly =
    "# 報告\n\n## 経緯\n\n問い合わせが増えました。回答が遅れました。\n\n## まとめ\n\n以上のように、問い合わせが増え、回答が遅れました。今後も改善に努めてまいります。\n";
  const jobsFor = (genre: string): string[] => planSemantic(buildDocument("report.md", closingOnly, ja), loadRules("ja"), [], {}, genre).map((job) => job.rule);

  it("報告書と提案書では結びを問い合わせる", () => {
    ["business/report", "business/proposal"].forEach((genre) => assert.ok(jobsFor(genre).includes("empty-conclusion"), genre));
  });

  it("メールと議事録とプレスリリースでは問い合わせない", () => {
    ["business/email", "business/meeting-notes", "business/press-release"].forEach((genre) => assert.ok(!jobsFor(genre).includes("empty-conclusion"), genre));
  });

  it("本文の数を繰り返すだけのまとめ（9月、目標）を送る", async () => {
    await ja.prepare?.({ pos: true });
    const job = planSemantic(buildDocument("report.md", PADDED_REPORT, ja), loadRules("ja"), [], {}, "business/report").find(
      (entry) => entry.rule === "empty-conclusion",
    );
    assert.equal(job?.candidates.length, 1);
    assert.match(job?.candidates[0]?.text ?? "", /^以上のように、9月は/u);
  });

  it("結びを見るジャンルでは、日付を見分ける品詞を読み込む。結びを見ないジャンルや、切った設定では読み込まない", () => {
    assert.equal(semanticNeeds(loadRules("ja"), {}, "business/report").pos, true);
    assert.equal(semanticNeeds(loadRules("ja"), {}, "business/email").pos, false);
    assert.equal(semanticNeeds(loadRules("ja"), { "empty-conclusion": "off" }, "business/report").pos, false);
  });
});
