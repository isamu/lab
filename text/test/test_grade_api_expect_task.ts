import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { grade, GradeInputError, type GradeOptions } from "../packages/chaff/src/grade-api.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { runCli } from "./cli-run.ts";
import { jsonl, resultsIn } from "./grade-run.ts";

// grade() takes an item's `expect` and `task` as a line of `chaff grade` does, and refuses what that line would be refused for.

const CLICHE = "The fee is $12,000, due 2026-03-31.\n\nIn conclusion, I hope this helps!\n";

const CHAFF_YAML = [
  "grade:",
  "  rules:",
  "    closing-cliche: { max: 0 }",
  "  tasks:",
  "    lenient:",
  "      rules:",
  "        closing-cliche: { max: 5 }",
  "",
].join("\n");

const TASKS = { ...EMPTY, grade: { rules: { "closing-cliche": { max: 0 } }, tasks: { lenient: { rules: { "closing-cliche": { max: 5 } } } } } };

const rejection = async (output: string, options: GradeOptions): Promise<readonly string[]> => {
  try {
    await grade(output, options);
  } catch (error) {
    assert.ok(error instanceof GradeInputError, String(error));
    return error.problems;
  }
  return assert.fail("grade() did not throw");
};

describe("grade() with expect", () => {
  it("passes an output that states every fact and none of the absent ones", async () => {
    const result = await grade("The fee is $12000, due 2026-03-31.", { expect: { facts: ["$12,000", "March 31, 2026"], absent: ["$15,000"] } });
    assert.deepEqual([result.pass, result.expect], [true, { checked: 3, missing: [], present: [] }]);
  });

  it("fails an output that misses a fact or states an absent one, in Japanese too", async () => {
    const en = await grade("The fee is $15,000.", { expect: { facts: ["$12,000"], absent: ["$15,000"] } });
    assert.deepEqual([en.pass, en.failedBecause], [false, ["expect.missing $12,000", "expect.present $15,000"]]);
    const ja = await grade("代金は15,000円です。", { expect: { facts: ["12,000円"] } });
    assert.deepEqual([ja.pass, ja.failedBecause], [false, ["expect.missing 12,000円"]]);
  });

  it("throws GradeInputError for an entry that is not one fact, or an expect of the wrong shape", async () => {
    assert.deepEqual(await rejection("The fee is $12,000.", { expect: { facts: ["hello"] } }), [
      "expect.facts[0] hello states no fact chaff can read (write one number, date, time, URL, code, name or quotation)",
    ]);
    assert.match(
      (await rejection("代金は12,000円です。", { expect: { facts: ["1万2000円"] } })).join(""),
      /^expect\.facts\[0\] 1万2000円 states more than one fact/u,
    );
    assert.deepEqual(await rejection("x", { expect: { facts: [""] } }), ['expect.facts must be { "facts": ["…"], "absent": ["…"] } with non-empty strings']);
  });
});

describe("grade() with task", () => {
  it("grades under the task's rubric laid over the top level, and records the task", async () => {
    const top = await grade(CLICHE, { config: TASKS });
    assert.deepEqual([top.pass, top.failedBecause, "task" in top], [false, ["rules.closing-cliche 1 > 0"], false]);
    const lenient = await grade(CLICHE, { config: TASKS, task: "lenient" });
    assert.deepEqual([lenient.pass, lenient.task], [true, "lenient"]);
  });

  it("grades by the rubric the task was checked against, when one settings object's grade: changes between calls", async () => {
    const config = { ...EMPTY, grade: { rules: { "closing-cliche": { max: 0 } } } };
    assert.equal((await grade(CLICHE, { config })).pass, false);
    Object.assign(config, TASKS);
    const lenient = await grade(CLICHE, { config, task: "lenient" });
    assert.deepEqual([lenient.pass, lenient.task], [true, "lenient"]);
  });

  it("throws GradeInputError for a task the rubric does not define, or when there is no rubric", async () => {
    assert.deepEqual(await rejection(CLICHE, { config: TASKS, task: "strict" }), ['task "strict" is not among the rubric\'s tasks']);
    assert.deepEqual(await rejection(CLICHE, { task: "lenient" }), ['task "lenient" is not among the rubric\'s tasks']);
    assert.deepEqual(await rejection(CLICHE, { config: TASKS, task: "" }), ["task must be a string"]);
  });
});

describe("grade() and chaff grade on the same inputs", () => {
  it("give the same results for items with task and expect", async () => {
    const items = [
      { id: "top", output: CLICHE, expect: { facts: ["$12,000"] } },
      { id: "lenient", output: CLICHE, task: "lenient", expect: { facts: ["$12,000"], absent: ["2026-03-31"] } },
      { id: "missing", output: "The fee is $15,000.", task: "lenient", expect: { facts: ["$12,000"] } },
    ];
    const run = await runCli({ "chaff.yaml": CHAFF_YAML, "items.jsonl": jsonl(...items) }, ["grade", "items.jsonl", "--out", "out.jsonl"], "en_US.UTF-8");
    const config = join(run.dir, "chaff.yaml");
    const viaApi = await Promise.all(items.map(({ output, ...options }) => grade(output, { ...options, config })));
    assert.deepEqual(
      viaApi.map((result) => [result.id, result.pass]),
      [
        ["top", false],
        ["lenient", false],
        ["missing", false],
      ],
    );
    assert.deepEqual(resultsIn(run.dir), viaApi);
  });

  it("both refuse an unknown task", async () => {
    const run = await runCli(
      { "chaff.yaml": CHAFF_YAML, "items.jsonl": jsonl({ id: "q", output: CLICHE, task: "strict" }) },
      ["grade", "items.jsonl"],
      "en_US.UTF-8",
    );
    assert.equal(run.code, 2);
    const problems = await rejection(CLICHE, { config: join(run.dir, "chaff.yaml"), task: "strict" });
    assert.equal(run.err, `items.jsonl: line 1: ${problems.join("")}`);
  });
});
