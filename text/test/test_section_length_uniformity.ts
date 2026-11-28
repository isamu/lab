import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { sectionLevels } from "../packages/chaff/src/section-levels.ts";
import type { LanguageAdapter, Section } from "../packages/chaff/src/plugin.ts";

const RULE = "section-length-uniformity";

const flagged = (source: string, adapter: LanguageAdapter = ja): boolean =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "blog/owned-media").findings.some((finding) => finding.rule === RULE);

const SENTENCE = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめも。";

const ANSWER = "最初は断ろうかと思いました。それでも、現場を知る人が要ると言われて引き受けました。";

const interview = (mark: string): string =>
  [
    "# 社員に聞きました",
    "今回は、営業部の人に話を聞きました。",
    ...["異動", "仕事", "工場", "目標", "休日"].flatMap((topic) => [`## ${topic}のこと`, `${mark}${topic}について教えてください。`, ANSWER]),
  ].join("\n\n");

describe("section-length-uniformity: an interview", () => {
  it("valid: sections that each open with the interviewer's question (――) are not compared", () => {
    assert.equal(flagged(interview("――")), false);
    assert.equal(flagged(interview("Q：")), false);
  });

  it("invalid: the same sections without the interviewer's mark are still reported", () => {
    assert.equal(flagged(interview("")), true);
  });

  it("English: Q: opens the interviewer's line", () => {
    const answer = "At first I almost said no. Then my manager told me the team needed someone who knew the floor.";
    const sections = ["Moving", "Work", "Factory", "Goals", "Weekends"].flatMap((topic) => [`## ${topic}`, `Q: What about ${topic.toLowerCase()}?`, answer]);
    const withMark = ["# Talking to our staff", "We talked to one of our sales staff.", ...sections].join("\n\n");
    assert.equal(flagged(withMark, en), false);
    assert.equal(flagged(withMark.replaceAll("Q: ", ""), en), true);
  });

  it("invalid: one question among many sections does not make an interview", () => {
    const sections = Array.from({ length: 5 }, (_, index) => `## 節${String(index)}\n\n${index === 0 ? "――" : ""}${SENTENCE}`).join("\n\n");
    assert.equal(flagged(`# 表題\n\n${SENTENCE}\n\n${sections}`), true);
  });
});

describe("section-length-uniformity: subsections", () => {
  it("valid: subsections are part of their section, not sections of their own", () => {
    // 4 short subsections under one heading: counted one by one, they made 8 sections of one size.
    const source = [
      "# パンの冷凍",
      SENTENCE,
      "## 冷凍がよい理由",
      SENTENCE,
      "## 冷凍のしかた",
      SENTENCE,
      "## 戻し方",
      ...["食パン", "バゲット", "クロワッサン", "あんぱん"].flatMap((name) => [`### ${name}`, SENTENCE]),
      "## さいごに",
      SENTENCE,
    ].join("\n\n");
    assert.equal(flagged(source), false);
  });

  it("valid: even subsections under a section with text of its own are parts of it", () => {
    // Seven principles of one guideline, each of one size, inside a section that introduces them.
    const sub = Array.from({ length: 7 }, (_, index) => [`### 原則${String(index + 1)}`, SENTENCE]).flat();
    const source = [
      "# 外で遊ぶ",
      "短い前置き。",
      "## 考える",
      `${SENTENCE}${SENTENCE}`,
      "## 痕跡を残さない",
      SENTENCE,
      ...sub,
      "## 練習する",
      `${SENTENCE}${SENTENCE}${SENTENCE}`,
      "## さいごに",
      "短い。",
    ].join("\n\n");
    assert.equal(flagged(source), false);
  });

  it("valid: subsections of one size in chapters parted by a column are not one run", () => {
    // Numbered chapters that only group their subsections, with a column of text between them.
    const sub = (names: readonly string[]): string[] => names.flatMap((name) => [`### ${name}`, SENTENCE]);
    const source = [
      "# 水害に備える",
      "短い前置き。",
      "## 1 水防とは",
      ...sub(["一", "二", "三"]),
      "## コラム",
      `${SENTENCE}${SENTENCE}${SENTENCE}${SENTENCE}`,
      "## 2 家庭で備える",
      ...sub(["四", "五", "六"]),
      "## まとめ",
      "短い。",
    ].join("\n\n");
    assert.equal(flagged(source), false);
  });

  it("invalid: subsections of one size across headings are compared with each other", () => {
    // Three pros and three cons as subheadings of one size. With their subsections, the top-level sections are not even.
    const sub = (names: readonly string[]): string[] => names.flatMap((name) => [`### ${name}`, SENTENCE]);
    const source = [
      "# 机を使ってみた",
      SENTENCE,
      "## 買ったもの",
      SENTENCE,
      "## よかったところ",
      ...sub(["一", "二", "三"]),
      "## 気になったところ",
      ...sub(["四", "五", "六"]),
      "## 結論",
      SENTENCE,
    ].join("\n\n");
    assert.equal(flagged(source), true);
  });
});

describe("sectionLevels", () => {
  const section = (depth: number, start: number): Section => ({
    depth,
    heading: "",
    span: { start, end: start + 1 },
    sentences: [],
    strongCount: 0,
    firstSentence: undefined,
  });
  const sizes = new Map<number, number>();
  const sized = (depth: number, start: number, size: number): Section => {
    sizes.set(start, size);
    return section(depth, start);
  };
  const size = (s: Section): number => sizes.get(s.span.start) ?? 0;

  it("a flat document is one level, with the title's introduction", () => {
    const sections = [sized(1, 0, 5), sized(2, 1, 10), sized(2, 2, 20)];
    assert.deepEqual(
      sectionLevels(sections, size).map((level) => level.lengths),
      [[5, 10, 20]],
    );
  });

  it("a section's length includes its subsections; under a heading with text, they are not a level of their own", () => {
    const sections = [sized(1, 10, 5), sized(2, 11, 10), sized(3, 12, 3), sized(3, 13, 4), sized(2, 14, 20)];
    assert.deepEqual(
      sectionLevels(sections, size).map((level) => level.lengths),
      [[5, 17, 20]],
    );
  });

  it("subsections under headings that only group them form a level across the document", () => {
    const sections = [sized(1, 40, 5), sized(2, 41, 0), sized(3, 42, 3), sized(3, 43, 4), sized(2, 44, 0), sized(3, 45, 6), sized(2, 46, 20)];
    assert.deepEqual(
      sectionLevels(sections, size).map((level) => level.lengths),
      [
        [5, 7, 6, 20],
        [3, 4, 6],
      ],
    );
  });

  it("a section with text between two groups ends the run of subsections", () => {
    const sections = [sized(1, 50, 5), sized(2, 51, 0), sized(3, 52, 3), sized(3, 53, 4), sized(2, 54, 9), sized(2, 55, 0), sized(3, 56, 6)];
    assert.deepEqual(
      sectionLevels(sections, size).map((level) => level.lengths),
      [[5, 7, 9, 6], [3, 4], [6]],
    );
  });

  it("no level without two headings of one depth, and none for no sections", () => {
    assert.deepEqual(sectionLevels([sized(1, 20, 5)], size), []);
    assert.deepEqual(sectionLevels([], size), []);
  });

  it("empty sections are left out", () => {
    const sections = [sized(1, 30, 0), sized(2, 31, 10), sized(2, 32, 0), sized(2, 33, 7)];
    assert.deepEqual(
      sectionLevels(sections, size).map((level) => level.lengths),
      [[10, 7]],
    );
  });
});
