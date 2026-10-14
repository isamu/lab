import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";
import {
  bodyOf,
  markedId,
  markerOf,
  openCaseOf,
  planIssues,
  planSummary,
  titleOf,
  type CaseProblem,
  type CorpusCase,
  type ExistingIssue,
} from "../scripts/corpus-cases-plan.ts";

// chaff-corpus の未解決の case（false-positive / missed）を lab の issue 一つずつに保つ計画。開く・更新する・閉じる・触らない。

const DOCUMENT = "docs/en/business/report/q3.md";

const expectedYaml = (findings: string): unknown => parse(["id: q3", "chaff: 0.33.0", "findings:", findings].join("\n"));

const FALSE_POSITIVE = [
  "  - rule: undefined-acronym",
  "    line: 18",
  "    text: TTS.",
  "    verdict: false-positive",
  "    note: expanded in the footer",
].join("\n");
const MISSED = ["  - rule: numbering-gap", "    line: 40", "    what: section 4 is followed by section 6", "    verdict: missed"].join("\n");
const CORRECT = ["  - rule: cliche", "    line: 35", "    text: on the same page", "    verdict: correct"].join("\n");

const caseOf = (findings: string): CorpusCase | CaseProblem => openCaseOf(expectedYaml(findings), "q3", DOCUMENT);

const openCase = (findings: string): CorpusCase => {
  const result = caseOf(findings);
  if ("problem" in result) throw new Error(result.problem);
  return result;
};

const problemOf = (result: CorpusCase | CaseProblem): string => {
  assert.ok("problem" in result, "expected a problem, got a case");
  return result.problem;
};

const issueFor = (corpusCase: CorpusCase, overrides: Partial<ExistingIssue> = {}): ExistingIssue => ({
  number: 7,
  title: titleOf(corpusCase),
  body: bodyOf(corpusCase),
  state: "OPEN",
  ...overrides,
});

describe("openCaseOf", () => {
  it("keeps the false-positive and missed entries, sorted by line, and drops correct ones", () => {
    const result = openCase([MISSED, CORRECT, FALSE_POSITIVE].join("\n"));
    assert.deepEqual(result.entries, [
      { verdict: "false-positive", rule: "undefined-acronym", line: 18, text: "TTS.", note: "expanded in the footer" },
      { verdict: "missed", rule: "numbering-gap", line: 40, text: "section 4 is followed by section 6" },
    ]);
    assert.equal(result.expectedPath, "expected/q3.yaml");
    assert.equal(result.documentPath, DOCUMENT);
  });

  it("gives a case with no entries when every finding is correct or there are none", () => {
    assert.deepEqual(openCase(CORRECT).entries, []);
    const empty = openCaseOf(parse("id: q3\nchaff: 0.33.0\n"), "q3", undefined);
    assert.ok(!("problem" in empty));
    assert.deepEqual(empty.entries, []);
    assert.equal(empty.documentPath, undefined);
  });

  it("calls a malformed file a problem instead of a case", () => {
    assert.match(problemOf(openCaseOf("just text", "q3", DOCUMENT)), /not a mapping/u);
    assert.match(problemOf(openCaseOf(null, "q3", DOCUMENT)), /not a mapping/u);
    assert.match(problemOf(openCaseOf(parse("id: other\nfindings: []"), "q3", DOCUMENT)), /id is not "q3"/u);
    assert.match(problemOf(openCaseOf(parse("id: q3\nfindings: nope"), "q3", DOCUMENT)), /not a list/u);
  });

  it("calls the whole file a problem when one entry is malformed, so its issue is not closed by mistake", () => {
    const cases: readonly [string, RegExp][] = [
      ["  - plain string", /findings\[1\] is not a mapping/u],
      ["  - line: 3\n    text: x\n    verdict: false-positive", /no rule/u],
      ["  - rule: r\n    line: 0\n    text: x\n    verdict: false-positive", /no positive line/u],
      ["  - rule: r\n    line: 2.5\n    text: x\n    verdict: false-positive", /no positive line/u],
      ["  - rule: r\n    line: 3\n    text: x\n    verdict: wrong", /unknown verdict/u],
      ["  - rule: r\n    line: 3\n    verdict: false-positive", /no text/u],
      ["  - rule: r\n    line: 3\n    text: x\n    verdict: missed", /no what/u],
    ];
    cases.forEach(([finding, pattern]) => {
      const result = caseOf([FALSE_POSITIVE, finding].join("\n"));
      assert.ok("problem" in result, finding);
      assert.match(result.problem, pattern);
    });
  });
});

describe("titleOf and bodyOf", () => {
  it("names the document and its rules in the order they first appear", () => {
    assert.equal(titleOf(openCase([FALSE_POSITIVE, MISSED].join("\n"))), "chaff-corpus: q3 — undefined-acronym, numbering-gap");
  });

  it("cuts a very long title", () => {
    const many = Array.from(
      { length: 30 },
      (_, index) => `  - rule: rule-number-${String(index)}\n    line: ${String(index + 1)}\n    text: x\n    verdict: false-positive`,
    );
    const title = titleOf(openCase(many.join("\n")));
    assert.ok(title.length <= 200);
    assert.ok(title.endsWith("…"));
  });

  it("marks the body, links each entry to its line and keeps mentions and backticks inert", () => {
    const tricky = ["  - rule: r", "    line: 5", "    text: 'a `b` @someone'", "    verdict: false-positive", "    note: ask @owner"].join("\n");
    const body = bodyOf(openCase([tricky, MISSED].join("\n")));
    assert.equal(markedId(body), "q3");
    assert.ok(body.startsWith(markerOf("q3")));
    assert.ok(body.includes(`https://github.com/isamu/chaff-corpus/blob/main/${DOCUMENT}?plain=1#L5`));
    assert.ok(body.includes("``a `b` @\u200bsomeone``"));
    assert.ok(body.includes("ask @\u200bowner"));
    assert.ok(!/@someone|@owner/u.test(body));
    assert.ok(body.includes("**missed** `numbering-gap`"));
  });

  it("does not link lines into a document whose text is not committed", () => {
    const body = bodyOf({ ...openCase(FALSE_POSITIVE), documentPath: "docs/en/business/report/q3.yaml" });
    assert.ok(body.includes("line 18:"));
    assert.ok(!body.includes("#L18"));
  });

  it("reads no marker from an issue this sync did not write", () => {
    assert.equal(markedId("A person's issue about corpus-case q3"), undefined);
    assert.equal(markedId("text\n<!-- corpus-case: a-b -->\nmore"), "a-b");
  });
});

describe("planIssues", () => {
  const q3 = openCase([FALSE_POSITIVE, MISSED].join("\n"));

  it("opens an issue for a new case", () => {
    const plan = planIssues([q3], []);
    assert.deepEqual(plan.actions, [{ kind: "create", id: "q3", title: titleOf(q3), body: bodyOf(q3) }]);
    assert.deepEqual(plan.unchanged, []);
  });

  it("leaves an issue that already says what the corpus says", () => {
    const plan = planIssues([q3], [issueFor(q3)]);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(plan.unchanged, ["q3"]);
  });

  it("updates the issue when the entries change", () => {
    const before = openCase(FALSE_POSITIVE);
    const plan = planIssues([q3], [issueFor(before)]);
    assert.deepEqual(plan.actions, [{ kind: "update", id: "q3", number: 7, title: titleOf(q3), body: bodyOf(q3), reopen: false }]);
  });

  it("updates the body when only a note changes and the title stays", () => {
    const before = openCase([FALSE_POSITIVE.replace("expanded in the footer", "old note"), MISSED].join("\n"));
    assert.equal(titleOf(before), titleOf(q3));
    const plan = planIssues([q3], [issueFor(before)]);
    assert.deepEqual(plan.actions, [{ kind: "update", id: "q3", number: 7, title: titleOf(q3), body: bodyOf(q3), reopen: false }]);
  });

  it("reopens a closed issue when its case has open entries again", () => {
    const plan = planIssues([q3], [issueFor(q3, { state: "CLOSED" })]);
    assert.equal(plan.actions.length, 1);
    assert.deepEqual(plan.actions[0], { kind: "update", id: "q3", number: 7, title: titleOf(q3), body: bodyOf(q3), reopen: true });
  });

  it("closes the issue when the document has no open entry left", () => {
    const plan = planIssues([openCase(CORRECT)], [issueFor(q3)]);
    assert.equal(plan.actions.length, 1);
    const [action] = plan.actions;
    assert.equal(action?.kind, "close");
    assert.ok(action?.kind === "close" && action.number === 7 && /resolved/u.test(action.comment));
  });

  it("closes the issue when the document is gone from the corpus", () => {
    const plan = planIssues([], [issueFor(q3)]);
    const [action] = plan.actions;
    assert.ok(action?.kind === "close" && /no longer in/u.test(action.comment));
  });

  it("leaves an already closed issue of a resolved case alone", () => {
    assert.deepEqual(planIssues([openCase(CORRECT)], [issueFor(q3, { state: "CLOSED" })]).actions, []);
  });

  it("keeps the issue of a malformed file as it is and reports the file", () => {
    const problem: CaseProblem = { id: "q3", problem: "findings is not a list" };
    const plan = planIssues([problem], [issueFor(q3)]);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(plan.problems, [problem]);
    assert.match(planSummary(plan), /skipped q3: findings is not a list/u);
  });

  it("ignores issues with the label but no marker", () => {
    const plan = planIssues([], [{ number: 3, title: "chaff-corpus: talk", body: "free text", state: "OPEN" }]);
    assert.deepEqual(plan.actions, []);
  });

  it("works on the open issue when a closed one has the same marker", () => {
    const plan = planIssues([q3], [issueFor(q3, { number: 2 }), issueFor(q3, { number: 9, state: "CLOSED" })]);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(plan.unchanged, ["q3"]);
  });

  it("orders the actions by document and counts them in the summary", () => {
    const other = { ...q3, id: "a-doc", expectedPath: "expected/a-doc.yaml" };
    const plan = planIssues([q3, other], [{ ...issueFor(q3), body: `${markerOf("gone")}\n` }]);
    assert.deepEqual(
      plan.actions.map((action) => [action.kind, action.id]),
      [
        ["create", "a-doc"],
        ["close", "gone"],
        ["create", "q3"],
      ],
    );
    assert.match(planSummary(plan), /^create 2, update 0, close 1, unchanged 0$/mu);
  });
});
