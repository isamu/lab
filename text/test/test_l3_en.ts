import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("en");

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

/** adverb-overuse は 200 語未満を測らない。密度を見る test はこれで嵩を足す。 */
const padded = (source: string): string => `${source}\n\n${"We shipped the release and the team reported the numbers. ".repeat(22)}`;

describe("L3 英語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  describe("adverb-overuse", () => {
    it("invalid: -ly 副詞の密度が高い", () => {
      const source = "The team moved quickly and delivered carefully. We wrote the code rapidly and reviewed it thoroughly and shipped it smoothly.";
      assert.ok(idsFor(padded(source)).includes("adverb-overuse"));
    });

    it("valid: 副詞が少なければ指摘しない", () => {
      assert.ok(!idsFor(padded("The team hurried and delivered. We wrote the code and reviewed it.")).includes("adverb-overuse"));
    });

    it("短い文書は測らない。密度が暴れるため", () => {
      assert.ok(!idsFor("We moved quickly and carefully and thoroughly.").includes("adverb-overuse"));
    });
  });

  describe("expletive-construction", () => {
    it("invalid: There is / It is ... that が重なる", () => {
      const source = "There is a need to review. There are risks. It is clear that we must act. There is no answer.";
      assert.ok(idsFor(source).includes("expletive-construction"));
    });

    it("valid: 主語が前に出ていれば指摘しない", () => {
      const source = "The board must review the budget. Several risks remain. We must act now. Nobody has an answer.";
      assert.ok(!idsFor(source).includes("expletive-construction"));
    });

    it("valid: that 節を伴わない it is は数えない", () => {
      // "It is raining" は正当な用法。
      const source = "It is raining. It is cold. It is late. It is quiet.";
      assert.ok(!idsFor(source).includes("expletive-construction"));
    });
  });

  describe("sentence-initial-conjunction-run", () => {
    it("invalid: 接続詞で始まる文が 4 つ続く", () => {
      assert.ok(
        idsFor("We shipped it. And we told the team. But the schedule slipped. So we adjusted. Yet nobody complained.").includes(
          "sentence-initial-conjunction-run",
        ),
      );
    });

    it("valid: 1 つだけなら指摘しない", () => {
      assert.ok(!idsFor("We shipped it. And we told the team. The schedule held.").includes("sentence-initial-conjunction-run"));
    });
  });

  describe("title-case-consistency", () => {
    it("invalid: sentence case の中に Title Case が 1 つ", () => {
      const source = "## About the parser\n\nText.\n\n## When using arrays\n\nText.\n\n## Usage Example Here\n\nText.";
      assert.ok(idsFor(source).includes("title-case-consistency"));
    });

    it("valid: 揃っていれば指摘しない", () => {
      const source = "## About the parser\n\nText.\n\n## When using arrays\n\nText.\n\n## Usage example here\n\nText.";
      assert.ok(!idsFor(source).includes("title-case-consistency"));
    });

    it("1 語の見出しは判定できない。どちらの流儀でも先頭は大文字", () => {
      const source = "## Parser\n\nText.\n\n## Renderer\n\nText.\n\n## Exporter\n\nText.";
      assert.ok(!idsFor(source).includes("title-case-consistency"));
    });
  });

  describe("oxford-comma-consistency", () => {
    it("invalid: 打つ文と打たない文が混ざる", () => {
      const source =
        "We shipped the parser, the renderer, and the exporter.\nThe team reviewed the plan, the budget, and the schedule.\nWe tested the code, the docs and the samples.";
      assert.ok(idsFor(source).includes("oxford-comma-consistency"));
    });

    it("valid: 揃っていれば、どちらの流儀でも指摘しない", () => {
      const with_ = "We shipped the parser, the renderer, and the exporter.\nWe tested the code, the docs, and the samples.";
      const without = "We shipped the parser, the renderer and the exporter.\nWe tested the code, the docs and the samples.";
      assert.ok(!idsFor(with_).includes("oxford-comma-consistency"));
      assert.ok(!idsFor(without).includes("oxford-comma-consistency"));
    });

    it("2 つの並列は判定しない。読点が入らないため", () => {
      assert.ok(!idsFor("We shipped the parser and the renderer.\nWe tested the code, the docs, and the samples.").includes("oxford-comma-consistency"));
    });

    // 候補の文が「読点のない並列」と判定されたときだけ、Oxford 側 2 文の中で少数派として指摘される。
    const WITH_COMMA = "We shipped the parser, the renderer, and the exporter.\nThe team reviewed the plan, the budget, and the schedule.";
    const WITHOUT_COMMA = "We shipped the parser, the renderer and the exporter.\nThe team reviewed the plan, the budget and the schedule.";
    const judgedAgainst = (base: string, candidate: string): boolean => idsFor(`${base}\n${candidate}`).includes("oxford-comma-consistency");

    [
      ["導入の句の読点と、2 つの動詞", "After the review, the team fixed the bug and shipped it."],
      ["導入の節の読点", "If it fails, retry and report."],
      ["導入の副詞の読点", "Finally, retry and report."],
      ["過去分詞で始まる導入の句の読点", "Based on the review, fix the parser and ship it."],
      ["前置詞のあとの名詞は、主語の前の導入の句", "Over this period, the subcommittees and the full committee considered the bills."],
      ["名詞の前で重ねた形容詞の読点", "Take the long, winding bridge and enjoy the view."],
      ["挿入の関係節の読点", "The team, which met on Monday, approved the plan and the budget."],
      ["セミコロンの前の読点は別の節", "It rained, the deadline moved; the parser and the renderer shipped."],
      ["節の並びに見えて、and の後ろが節ではない", "We listen, these are crucial to the team and getting results."],
      ["括弧の中の and は、括弧の外の項目と並べない", "It rained, it snowed (the roads and the rails closed)."],
      ["and の後ろの項目は次の読点まで", "We listen, the team is crucial to us and the results, which vary."],
    ].forEach(([why, candidate]) => {
      it(`valid: ${why ?? ""}`, () => {
        assert.ok(!judgedAgainst(WITH_COMMA, candidate ?? ""));
      });
    });

    it("valid: 節をつなぐ and の前の読点は Oxford comma ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We tested it, and the team shipped it."));
    });

    it("valid: and の後ろが項目と違う形なら並列ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We fixed the parser, the renderer, and then we rested."));
    });

    it("valid: 述語の並びなら、どの項目にも動詞がある。主語は項目ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "The scope of the data, in contrast, is larger, and covers the whole body."));
    });

    it("valid: 節の並びなら、どの項目も節。導入の語は項目ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "Additionally, when we share them, others can learn from us, and the same mistake is rarer."));
    });

    it("invalid: 動詞で始まる最初の項目は、名詞の並びの前置き", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "Read the guide, the notes and the index."));
    });

    it("invalid: 動詞で始まる項目は、後ろに動詞があっても節ではない", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "They wrote the code, explained what changed, and shipped the release."));
    });

    it("invalid: 主語の並びは、and の後ろに述語が続いても並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "The parser, the renderer and the exporter shipped."));
    });

    it("invalid: 節が 3 つ並べば並列", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "The parser failed, the renderer crashed, and the exporter stopped."));
    });

    it("invalid: 括弧の中の読点は項目を切らない", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We tested the parser, the renderer (the slow one, sadly), and the exporter."));
    });

    it("invalid: 導入の句のあとの本当の並列は判定する", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "After the review, we fixed the parser, the renderer and the exporter."));
    });

    it("invalid: 冠詞の有無は形の違いにしない", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We need the code, the docs and samples."));
    });

    it("invalid: 固有名詞・形容詞で始まる項目も名詞の並び", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We visited Paris, the old port and the museums."));
    });

    it("invalid: 過去分詞が並べば、文頭でも並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "Tested, reviewed and approved, the release went out."));
    });

    it("invalid: 形容詞そのものの並びは切ったまま", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "The tool is quick, cheap and reliable."));
    });

    it("invalid: 同じ形の副詞が並べば、文頭でも並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "Quickly, quietly and carefully, we moved."));
    });

    it("invalid: 最初の and が並列でなくても、後ろの並列を見る", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We wrote the parser and the renderer, the exporter, and the tests."));
    });
  });

  it("英語の rule は日本語で動かさない", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "business/report");
    ["adverb-overuse", "expletive-construction", "title-case-consistency", "oxford-comma-consistency"].forEach((id) => {
      assert.ok(
        result.skipped.some((entry) => entry.rule === id),
        `${id} が skip されていない`,
      );
    });
  });

  it("書き出しの同じさは、英語では語で測る", () => {
    // 文字で切ると "We continued" が "Wecont" になり、引用がそのまま読み手に出る。
    const source = "We continued the work and reported the numbers. ".repeat(5);
    const findings = runRules(buildDocument("t.md", source, en), RULES, {}, true, "blog/tech").findings;
    const head = findings.find((finding) => finding.rule === "repeated-sentence-head");
    assert.equal(head?.values["head"], "We continued the");
  });
});
