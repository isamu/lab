import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";
import { compositeSignals, SAME_SHAPE_VALUE } from "../packages/chaff/src/composite-signals.ts";

const RULES = loadRules("ja");

const findingsFor = (source: string): readonly Finding[] => runRules(buildDocument("t.md", source, ja), RULES, {}, true, "blog/tech").findings;

const idsFor = (source: string): string[] => findingsFor(source).map((finding) => finding.rule);

const THREES = [
  "できることは 3 つです。\n\n- 速い\n- 安い\n- 強い",
  "使いかたも 3 つです。\n\n- 読む\n- 書く\n- 直す",
  "注意点も 3 つです。\n\n- 準備\n- 実行\n- 確認",
].join("\n\n");

/** ai-tell / rule-of-three / padded-intro / closing-cliche の 4 種が出る文書。 */
const MANY = [
  "# はじめに",
  "",
  "近年、この分野は急速に変化する状況にあります。現代社会において、重要な役割を果たしていると言えるでしょう。",
  "",
  THREES,
  "",
  "まとめると、大きな可能性を秘めていると言えるでしょう。ぜひ参考にしてみてください。",
].join("\n");

describe("複合シグナル", () => {
  it("invalid: 3 種そろったら 1 件にまとめて出す", () => {
    assert.ok(idsFor(MANY).includes("ai-generated-composite"));
  });

  it("どの signal がそろったのかを言う", () => {
    const found = findingsFor(MANY).find((finding) => finding.rule === "ai-generated-composite");
    assert.match(String(found?.values["word"] ?? ""), /ai-tell/u);
    assert.ok(Number(found?.values["count"] ?? 0) >= 3);
  });

  it("valid: 1 種だけでは出さない", () => {
    // 単独では普通の文章に出る。揃ったときだけ意味がある。
    assert.ok(!idsFor("# はじめに\n\n近年、この仕組みが動いています。中身はこうです。").includes("ai-generated-composite"));
  });

  it("元の指摘は消さない", () => {
    // まとめるために消すと、単独でも正しい指摘（padded-intro）が見えなくなる。
    const ids = idsFor(MANY);
    assert.ok(ids.includes("padded-intro"));
    assert.ok(ids.includes("ai-generated-composite"));
  });

  it("一段目で「検出器が無い」と言わせない", () => {
    const result = runRules(buildDocument("t.md", MANY, ja), RULES, {}, true, "blog/tech");
    assert.ok(!result.skipped.some((entry) => entry.rule === "ai-generated-composite"));
  });

  describe("ブログは 2 種で出す", () => {
    /** padded-intro と rule-of-three の 2 種だけが出る文書。 */
    const TWO = ["# はじめに", "", "近年、この分野は注目を集めています。", "", THREES].join("\n");
    const compositeIn = (genre: string): boolean =>
      runRules(buildDocument("t.md", TWO, ja), RULES, {}, true, genre).findings.some((finding) => finding.rule === "ai-generated-composite");

    it("invalid: ブログの記事なら 2 種で出す", () => {
      assert.ok(compositeIn("blog/tech"));
      assert.ok(compositeIn("blog/essay"));
    });

    it("valid: ほかのジャンルでは 2 種では出さない（3 種から）", () => {
      assert.ok(!compositeIn("business/report"));
    });

    it("valid: ブログでも 1 種では出さない", () => {
      const one = ["# はじめに", "", "近年、この分野は注目を集めています。中身はこうです。"].join("\n");
      const ids = runRules(buildDocument("t.md", one, ja), RULES, {}, true, "blog/tech").findings.map((finding) => finding.rule);
      assert.ok(ids.includes("padded-intro") && !ids.includes("ai-generated-composite"));
    });
  });

  it("設定で止められる", () => {
    const result = runRules(buildDocument("t.md", MANY, ja), RULES, { "ai-generated-composite": "off" }, true, "blog/tech");
    assert.ok(!result.findings.some((finding) => finding.rule === "ai-generated-composite"));
  });
});

describe("no-em-dash", () => {
  const BULK = "本日の連絡です — 今日も順調に進めています。明日も続けます — 引き続きお願いします。".repeat(16);
  const BULK_EN = "We shipped it — and the team reported the numbers — on Friday. ".repeat(40);

  it("invalid: ダッシュが多い", () => {
    assert.ok(idsFor(`# 報告\n\n${BULK}`).includes("no-em-dash"));
  });

  it("valid: 読点で書いていれば指摘しない", () => {
    assert.ok(!idsFor(`# 報告\n\n${"本日の連絡です。今日も順調に進めています。".repeat(20)}`).includes("no-em-dash"));
  });

  it("severity が言語で変わる。記号の許容度は言語で違う", () => {
    // 日本語の組版ではダッシュが扱いにくく、英語では正当な用法が多い。
    const jaSeverity = findingsFor(`# 報告\n\n${BULK}`).find((finding) => finding.rule === "no-em-dash")?.severity;
    const enFindings = runRules(buildDocument("t.md", `# Report\n\n${BULK_EN}`, en), loadRules("en"), {}, true, "blog/tech").findings;
    assert.equal(jaSeverity, "warning");
    assert.equal(enFindings.find((finding) => finding.rule === "no-em-dash")?.severity, "info");
  });

  it("複合シグナルの入力になっている", () => {
    const composite = loadRules("ja").find((rule) => rule.id === "ai-generated-composite");
    assert.ok(composite?.from.includes("no-em-dash"));
  });
});

describe("the composite on an English document", () => {
  const RULES_EN = loadRules("en");
  before(async () => {
    await en.prepare?.({ pos: true });
  });
  const LISTS = [
    "It does three things.\n\n- fast\n- cheap\n- strong",
    "It has three uses.\n\n- read\n- write\n- fix",
    "Mind three things.\n\n- prepare\n- run\n- check",
  ].join("\n\n");
  const ENGLISH = [
    "# Introduction",
    "",
    "In today's fast-paced world, this field has gained significant attention. We delve into the tapestry of ideas.",
    "",
    LISTS,
    "",
    "In conclusion, it plays a crucial role. Hope this helps, and thanks for reading.",
  ].join("\n");

  it("fires on two signals in a blog post, and needs three in a report", () => {
    const two = ["# Introduction", "", "In today's fast-paced world, this field has gained significant attention.", "", LISTS].join("\n");
    const compositeIn = (genre: string): boolean =>
      runRules(buildDocument("t.md", two, en), RULES_EN, {}, true, genre).findings.some((finding) => finding.rule === "ai-generated-composite");
    assert.ok(compositeIn("blog/tech"));
    assert.ok(!compositeIn("business/report"));
  });

  const signalsOf = (source: string, genre = "blog/tech"): string[] => {
    const found = runRules(buildDocument("t.md", source, en), RULES_EN, {}, true, genre).findings.find((finding) => finding.rule === "ai-generated-composite");
    return found === undefined ? [] : String(found.values["word"]).split(", ");
  };
  const FILLER = "We shipped the release and reported the numbers to the team. ".repeat(20);
  const SWEEPING = "Most people never back up their photos. Nobody thinks about it until a phone breaks. Then everyone wishes they had a copy.";
  const FRAGMENTS = "Is the new setup perfect? No. It still drops a file now and then. The result? Faster builds and fewer late nights.";
  const BOLD = Array.from({ length: 4 }, (_unused, index) => `Step ${String(index + 1)} is **really important** for the result.`).join(" ");

  it("reads sweeping claims, fragment answers and scattered bold as three signals", () => {
    const post = ["# Backups", "", SWEEPING, "", FRAGMENTS, "", BOLD, "", FILLER].join("\n");
    assert.deepEqual(
      signalsOf(post).toSorted((left, right) => left.localeCompare(right, "en")),
      ["bold-emphasis", "over-general-claim", "q-fragment-answer"],
    );
  });

  it("does not read bold labels on list items: ai-structure already measures that shape", () => {
    const labels = Array.from({ length: 6 }, (_unused, index) => `- **Point ${String(index + 1)}**: what the team checks that week.`).join("\n");
    const post = ["# Backups", "", SWEEPING, "", BOLD, "", labels, "", FILLER].join("\n");
    assert.ok(!signalsOf(post).includes("bold-label-list"));
    assert.ok(!RULES_EN.find((rule) => rule.id === "ai-generated-composite")?.from.includes("bold-label-list"));
  });

  it("names the signals with a comma, not 「、」", () => {
    const found = runRules(buildDocument("t.md", ENGLISH, en), RULES_EN, {}, true, "blog/tech").findings.find(
      (finding) => finding.rule === "ai-generated-composite",
    );
    const word = String(found?.values["word"] ?? "");
    assert.ok(word.includes(", ") && !word.includes("、"), word);
  });
});

describe("one sign counts once in the composite", () => {
  const FROM = ["rule-of-three", "section-length-uniformity", "colon-lead-in", "ai-structure"];
  const finding = (rule: string, values: Finding["values"] = {}): Finding => ({ rule, severity: "info", line: 1, column: 1, quote: "", values });
  /** ai-structure past its limit of 3 on section length variation, sections of one or two paragraphs and bold labels. */
  const structure = (count: number, sameShape: string): Finding => finding("ai-structure", { count, limit: 3, [SAME_SHAPE_VALUE]: sameShape });

  it("invalid: ai-structure counts when enough of its measures are its own", () => {
    const found = [finding("section-length-uniformity"), structure(4, "section-length-uniformity")];
    assert.deepEqual(compositeSignals(FROM, found), ["section-length-uniformity", "ai-structure"]);
  });

  it("valid: ai-structure does not count again a shape its twin rule already counted", () => {
    const found = [finding("section-length-uniformity"), structure(3, "section-length-uniformity")];
    assert.deepEqual(compositeSignals(FROM, found), ["section-length-uniformity"]);
  });

  it("takes out every twin that fired, and only those", () => {
    const both = "section-length-uniformity,rule-of-three";
    assert.deepEqual(compositeSignals(FROM, [finding("rule-of-three"), finding("section-length-uniformity"), structure(4, both)]), [
      "rule-of-three",
      "section-length-uniformity",
    ]);
    assert.deepEqual(compositeSignals(FROM, [finding("rule-of-three"), structure(4, both)]), ["rule-of-three", "ai-structure"]);
  });

  it("does not take out a twin that is not one of the composite's signals", () => {
    assert.deepEqual(compositeSignals(FROM, [finding("bold-label-list"), structure(3, "bold-label-list")]), ["ai-structure"]);
  });

  it("counts a finding with no twins, an empty list or no numbers as it is", () => {
    assert.deepEqual(compositeSignals(FROM, [finding("colon-lead-in"), structure(3, "")]), ["colon-lead-in", "ai-structure"]);
    const unnumbered = finding("ai-structure", { [SAME_SHAPE_VALUE]: "colon-lead-in" });
    assert.deepEqual(compositeSignals(FROM, [finding("colon-lead-in"), unnumbered]), ["colon-lead-in", "ai-structure"]);
    assert.deepEqual(compositeSignals(FROM, []), []);
    assert.deepEqual(compositeSignals([], [finding("colon-lead-in")]), []);
  });
});
