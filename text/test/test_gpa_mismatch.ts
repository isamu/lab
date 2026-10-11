import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import {
  averageOf,
  courseColumnsOf,
  gpaStatementsOf,
  gradedRowsOf,
  gradingKeyOf,
  pointsFor,
  scalePointsOf,
  withinRounding,
  type GpaStatement,
  type GradeWord,
  type TranscriptWord,
} from "../packages/chaff/src/structure/gpa.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// GPA と、同じ文書の科目の評価・単位数（gpa-mismatch）。例は自作。

const RULE = "gpa-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 成績\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["gpa"])}:${String(finding.values["computed"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

const jaTable = (rows: readonly string[]): string => ["| 科目 | 単位数 | 評価 |", "| --- | --- | --- |", ...rows].join("\n");
const enTable = (rows: readonly string[]): string => ["| Course | Credits | Grade |", "| --- | --- | --- |", ...rows].join("\n");

// S4×2 + A3×2 + B2×4 = 22, over 8 credits: 2.75.
const JA_ROWS = ["| 経済学入門 | 2 | S |", "| 統計学 | 2 | A |", "| ミクロ経済学 | 4 | B |"];
// With A (4), B (3), C (2): B3×4 + C2×2 + A4×6 = 40, over 12 credits: 3.33.
const EN_ROWS = ["| Food Safety | 4 | B |", "| Nutrition | 2 | C |", "| Pastry Practicum | 6 | A |"];
const EN_KEY = "Grades are A (4), B (3), C (2) and D (1).";

describe("gpa-mismatch on a whole document", () => {
  it("reports a written GPA the course rows do not give, in Japanese", () => {
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\nGPA：3.20`, ja), ["3.20:2.75"]);
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\n評価平均（GPA）：3.2`, ja), ["3.2:2.8"]);
  });

  it("is silent on the GPA the course rows give, in Japanese", () => {
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\nGPA：2.75`, ja), []);
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\nGPA（累積）：2.8`, ja), []);
  });

  it("reads the grading key the document writes before the lexicon's scales, in English", () => {
    assert.deepEqual(found(`${enTable(EN_ROWS)}\n\n${EN_KEY}\n\nGrade point average (GPA): 3.52`, en), ["3.52:3.33"]);
    assert.deepEqual(found(`${enTable(EN_ROWS)}\n\n${EN_KEY}\n\nGPA: 3.33`, en), []);
  });

  it("is silent when the grades A, B and C fit two scales with different points and no key says which", () => {
    assert.deepEqual(found(`${enTable(EN_ROWS)}\n\nGPA: 3.52`, en), []);
    assert.deepEqual(found(`${enTable(EN_ROWS)}\n\nRoom choices are A (4), B (3), C (2).\n\nGPA: 3.52`, en), []);
  });

  it("falls back on the scale when the key names only some of the grades", () => {
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\n評価はS（4）の4段階です。\n\nGPA：3.20`, ja), ["3.20:2.75"]);
  });

  it("leaves a course with a grade that carries no points out of both sums", () => {
    assert.deepEqual(found(`${jaTable([...JA_ROWS, "| 海外研修 | 4 | 認定 |"])}\n\nGPA：2.75`, ja), []);
    assert.deepEqual(found(`${jaTable([...JA_ROWS, "| 海外研修 | 4 | 認定 |"])}\n\nGPA：1.83`, ja), ["1.83:2.75"]);
  });

  it("does not count a total row as a course", () => {
    assert.deepEqual(found(`${jaTable([...JA_ROWS, "| 修得単位合計 | 8 | — |"])}\n\nGPA：2.75`, ja), []);
    assert.deepEqual(found(`${enTable([...EN_ROWS, "| Total credits earned | 12 | — |"])}\n\n${EN_KEY}\n\nGPA: 3.00`, en), ["3.00:3.33"]);
  });

  it("says nothing without a GPA line or without a course table", () => {
    assert.deepEqual(found(jaTable(JA_ROWS), ja), []);
    assert.deepEqual(found("GPA：3.20", ja), []);
    assert.deepEqual(found(`| 科目 | 評価 |\n| --- | --- |\n| 統計学 | A |\n\nGPA：3.20`, ja), []);
  });

  it("says nothing when a course's grade or credits cannot be read", () => {
    assert.deepEqual(found(`${jaTable([...JA_ROWS, "| 演習 | 2 | 合格見込 |"])}\n\nGPA：3.20`, ja), []);
    assert.deepEqual(found(`${jaTable([...JA_ROWS, "| 演習 | 二 | A |"])}\n\nGPA：3.20`, ja), []);
  });

  it("says nothing when the document also writes the GPA of one term, or a second value", () => {
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\n前期GPA：3.00\n\nGPA：3.20`, ja), []);
    assert.deepEqual(found(`${enTable(EN_ROWS)}\n\n${EN_KEY}\n\nTerm GPA: 3.10\n\nGPA: 3.52`, en), []);
    assert.deepEqual(found(`${jaTable(JA_ROWS)}\n\nGPA：3.20\n\n累積GPA：3.10`, ja), []);
    assert.deepEqual(found(`${enTable(EN_ROWS)}\n\n${EN_KEY}\n\nMinimum GPA for honours: 3.5\n\nGPA: 3.52`, en), []);
  });

  it("reports every line that writes the same wrong GPA", () => {
    assert.deepEqual(found(`GPA：3.20\n\n${jaTable(JA_ROWS)}\n\nGPA：3.20`, ja), ["3.20:2.75", "3.20:2.75"]);
  });
});

const COLUMNS: readonly TranscriptWord[] = [
  { pattern: "grade points", role: "points" },
  { pattern: "grade", role: "grade" },
  { pattern: "credits", role: "credits" },
  { pattern: "course", role: "course" },
];

describe("courseColumnsOf", () => {
  it("finds the grade and credits columns by heading words, not by place", () => {
    assert.deepEqual(courseColumnsOf(["Course", "Credits", "Grade", "Grade points"], COLUMNS), { grade: 2, credits: 1 });
    assert.deepEqual(courseColumnsOf(["Grade", "Course", "Credits"], COLUMNS), { grade: 0, credits: 2 });
  });

  it("reads no table without a course column, or with two grade or credits columns", () => {
    assert.equal(courseColumnsOf(["Name", "Credits", "Grade"], COLUMNS), undefined);
    assert.equal(courseColumnsOf(["Course", "Credits", "Grade", "Final grade"], COLUMNS), undefined);
    assert.equal(courseColumnsOf(["Course", "Grade points"], COLUMNS), undefined);
    assert.equal(courseColumnsOf([], COLUMNS), undefined);
  });
});

const GRADES: readonly GradeWord[] = [
  { pattern: "S", scale: "s-d", points: 4 },
  { pattern: "A", scale: "s-d", points: 3 },
  { pattern: "B", scale: "s-d", points: 2 },
  { pattern: "A", scale: "a-f", points: 4 },
  { pattern: "B", scale: "a-f", points: 3 },
  { pattern: "D", scale: "a-f", points: 1 },
  { pattern: "Pass", scale: "none" },
];

describe("gradedRowsOf", () => {
  it("drops a grade with no points and reads the credits", () => {
    const rows = [
      { grade: "A", credits: "2" },
      { grade: "Pass", credits: "" },
      { grade: "B", credits: "1.5" },
    ];
    assert.deepEqual(gradedRowsOf(rows, GRADES), [
      { grade: "A", credits: 2 },
      { grade: "B", credits: 1.5 },
    ]);
  });

  it("gives nothing when a grade is on no scale or the credits are not a number", () => {
    assert.equal(gradedRowsOf([{ grade: "E", credits: "2" }], GRADES), undefined);
    assert.equal(gradedRowsOf([{ grade: "A", credits: "" }], GRADES), undefined);
    assert.equal(gradedRowsOf([{ grade: "A", credits: "2単位" }], GRADES), undefined);
    assert.equal(gradedRowsOf([{ grade: "", credits: "2" }], GRADES), undefined);
  });
});

describe("scalePointsOf", () => {
  it("takes the one scale that holds every grade", () => {
    assert.deepEqual(
      scalePointsOf(["S", "A"], GRADES),
      new Map([
        ["S", 4],
        ["A", 3],
      ]),
    );
    assert.deepEqual(
      scalePointsOf(["A", "D"], GRADES),
      new Map([
        ["A", 4],
        ["D", 1],
      ]),
    );
  });

  it("gives nothing when two scales disagree, or none holds the grades", () => {
    assert.equal(scalePointsOf(["A", "B"], GRADES), undefined);
    assert.equal(scalePointsOf(["S", "D"], GRADES), undefined);
    assert.equal(scalePointsOf(["E"], GRADES), undefined);
  });
});

const CUES = ["grade", "grades", "評価"];

describe("gradingKeyOf and pointsFor", () => {
  const line = (text: string): { text: string; start: number } => ({ text, start: 0 });

  it("reads a grade with its points in brackets or after =", () => {
    assert.deepEqual(
      gradingKeyOf([line("評価はS（4）、A（3）、B（2）の3段階")], GRADES, CUES),
      new Map([
        ["S", 4],
        ["A", 3],
        ["B", 2],
      ]),
    );
    assert.deepEqual(
      gradingKeyOf([line("Grades: A = 4, B = 3")], GRADES, CUES),
      new Map([
        ["A", 4],
        ["B", 3],
      ]),
    );
    assert.deepEqual(gradingKeyOf([line("No key here, Plan B (draft).")], GRADES, CUES), new Map());
  });

  it("reads no pairs from a line that does not name grades", () => {
    assert.deepEqual(gradingKeyOf([line("Room choices are A (4), B (3), C (2).")], GRADES, CUES), new Map());
  });

  it("is a conflict when one grade gets two points, or a number too large to be points", () => {
    assert.equal(gradingKeyOf([line("Grade A (4)"), line("Grade A (3)")], GRADES, CUES), "conflict");
    assert.equal(gradingKeyOf([line("評価 S（90）、A（80）")], GRADES, CUES), "conflict");
  });

  it("uses a key only when it gives every used grade its points", () => {
    const key = new Map([
      ["A", 4],
      ["B", 3],
    ]);
    assert.equal(pointsFor(["A", "B"], key, GRADES), key);
    assert.equal(pointsFor(["A", "S"], key, GRADES), undefined);
    assert.equal(pointsFor(["S", "A"], "conflict", GRADES), undefined);
    assert.deepEqual(
      pointsFor(["S", "A"], new Map(), GRADES),
      new Map([
        ["S", 4],
        ["A", 3],
      ]),
    );
  });
});

describe("gpaStatementsOf", () => {
  const labels = [
    { pattern: "GPA", part: false },
    { pattern: "grade point average", part: false },
    { pattern: "term", part: true },
  ];
  const line = (text: string): { text: string; start: number } => ({ text, start: 100 });

  it("reads the number after a label that is a GPA word outside its brackets", () => {
    assert.deepEqual(gpaStatementsOf([line("Grade point average (GPA): 3.25 / 4.00")], labels), [{ offset: 127, text: "3.25", value: 3.25, decimals: 2 }]);
    assert.deepEqual(gpaStatementsOf([line("- **GPA**: 3")], labels), [{ offset: 111, text: "3", value: 3, decimals: 0 }]);
  });

  it("reads nothing from a line with no number, no colon or no GPA word", () => {
    assert.deepEqual(gpaStatementsOf([line("GPA: not computed")], labels), []);
    assert.deepEqual(gpaStatementsOf([line("The GPA is 3.25.")], labels), []);
    assert.deepEqual(gpaStatementsOf([line("Credits: 32")], labels), []);
  });
});

describe("withinRounding and averageOf", () => {
  const written = (value: number, decimals: number): GpaStatement => ({ offset: 0, text: String(value), value, decimals });

  it("allows rounding and cutting off to the written decimals", () => {
    assert.equal(withinRounding(written(3.26, 2), 3.256), true);
    assert.equal(withinRounding(written(3.25, 2), 3.256), true);
    assert.equal(withinRounding(written(3.3, 1), 3.25), true);
    assert.equal(withinRounding(written(3, 0), 3.4), true);
  });

  it("does not allow more", () => {
    assert.equal(withinRounding(written(3.24, 2), 3.256), false);
    assert.equal(withinRounding(written(3.27, 2), 3.256), false);
    assert.equal(withinRounding(written(3.52, 2), 3.25), false);
  });

  it("averages points by credits, and gives nothing with no credits", () => {
    const points = new Map([
      ["A", 4],
      ["B", 3],
    ]);
    assert.equal(
      averageOf(
        [
          { grade: "A", credits: 2 },
          { grade: "B", credits: 6 },
        ],
        points,
      ),
      3.25,
    );
    assert.equal(averageOf([{ grade: "A", credits: 0 }], points), undefined);
    assert.equal(averageOf([], points), undefined);
  });
});
