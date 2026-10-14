import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseItems, type ItemVocabulary } from "../packages/chaff/src/grade/item.ts";
import { parseRubric, type Rubric } from "../packages/chaff/src/grade/rubric.ts";
import { parseRubricFile } from "../packages/chaff/src/grade/rubric-file.ts";
import type { GradeResult } from "../packages/chaff/src/grade/result.ts";
import { rubricForTask, rubricRuleEntries, taskNamesOf, taskRuleIds } from "../packages/chaff/src/grade/task-rubric.ts";
import { runCli } from "./cli-run.ts";
import { jsonl, resultsIn } from "./grade-run.ts";

// A rubric's `tasks:` and an item's `task`: one benchmark, several question types, each graded by its own rubric.

const rubricOf = (raw: unknown): Rubric => {
  const parsed = parseRubric(raw);
  assert.ok("rubric" in parsed && parsed.rubric !== undefined, JSON.stringify(parsed));
  return parsed.rubric;
};

const problemsOf = (raw: unknown): string[] => {
  const parsed = parseRubric(raw);
  return "problems" in parsed ? parsed.problems.map((problem) => `${problem.path}:${problem.expected}`) : [];
};

const TOP = {
  rules: { "total-mismatch": { max: 0 }, "ai-tell": { max_rate: 5, weight: 2 } },
  facts: { dropped: 0, allow_dropped: ["heading"] },
  citations: { failed: 0, required: true },
  penalty: 10,
};

describe("reading a rubric's tasks", () => {
  it("reads each task with the top-level schema, keeping what it did not write undefined", () => {
    const rubric = rubricOf({ ...TOP, tasks: { extract: { rules: { "total-mismatch": { max: 2 } } }, summary: { penalty: 3 }, plain: null } });
    assert.deepEqual(taskNamesOf(rubric), ["extract", "summary", "plain"]);
    assert.deepEqual(rubric.tasks?.["plain"], { rules: {} });
    assert.equal(rubric.tasks?.["summary"]?.penalty, 3);
    assert.equal(rubric.tasks?.["summary"]?.facts, undefined);
  });

  it("leaves a rubric without tasks exactly as before: no tasks key", () => {
    assert.equal("tasks" in rubricOf(TOP), false);
    assert.deepEqual(taskNamesOf(rubricOf(TOP)), []);
    assert.deepEqual(taskNamesOf(undefined), []);
  });

  it("names every problem in a task by its path under grade.tasks", () => {
    assert.deepEqual(problemsOf({ tasks: { x: { rules: { "ai-tell": { max_rte: 3 } } } } }), ["grade.tasks.x.rules.ai-tell.max_rte:known-key"]);
    assert.deepEqual(problemsOf({ tasks: { x: { facts: { dropped: -1 }, penalty: "a" } } }), [
      "grade.tasks.x.facts.dropped:count",
      "grade.tasks.x.penalty:number",
    ]);
    assert.deepEqual(problemsOf({ tasks: { x: { citations: { required: "yes" } } } }), ["grade.tasks.x.citations.required:boolean"]);
    assert.deepEqual(problemsOf({ tasks: { x: { contexts: [] } } }), ["grade.tasks.x.contexts:map"]);
    assert.deepEqual(problemsOf({ tasks: { x: { required_sections: [""] } } }), ["grade.tasks.x.required_sections:words"]);
    assert.deepEqual(problemsOf({ tasks: { x: 3 } }), ["grade.tasks.x:map"]);
    assert.deepEqual(problemsOf({ tasks: ["x"] }), ["grade.tasks:map"]);
    assert.deepEqual(problemsOf({ tasks: null }), ["grade.tasks:map"]);
  });

  it("refuses tasks inside a task: nesting would leave which rubric applies unclear", () => {
    assert.deepEqual(problemsOf({ tasks: { x: { tasks: { y: { penalty: 1 } } } } }), ["grade.tasks.x.tasks:known-key"]);
  });

  it("names a task's problem from the top of a --rubric file", () => {
    const parsed = parseRubricFile("r.yaml", "tasks:\n  x:\n    facts: { dropped: none }\n");
    assert.ok("problems" in parsed);
    assert.deepEqual(
      parsed.problems.map((problem) => (problem.kind === "rubric" ? problem.problem.path : problem.kind)),
      ["tasks.x.facts.dropped"],
    );
  });
});

describe("the rubric for a task", () => {
  const rubric = rubricOf({
    ...TOP,
    tasks: {
      lenient: { rules: { "total-mismatch": { max: 5 }, "kanji-ratio": { max: 1 } }, penalty: 20 },
      facts: { facts: { added: 0 } },
      empty: null,
    },
  });

  it("is the rubric itself for an item without a task", () => {
    assert.equal(rubricForTask(rubric, undefined), rubric);
    assert.equal(rubricForTask(undefined, undefined), undefined);
  });

  it("replaces a rule's entry per rule id and inherits the other ids", () => {
    assert.deepEqual(rubricForTask(rubric, "lenient")?.rules, {
      "total-mismatch": { max: 5, maxRate: undefined, weight: undefined },
      "ai-tell": { max: undefined, maxRate: 5, weight: 2 },
      "kanji-ratio": { max: 1, maxRate: undefined, weight: undefined },
    });
  });

  it("replaces a key the task writes whole and inherits every key it does not write", () => {
    const lenient = rubricForTask(rubric, "lenient");
    assert.equal(lenient?.penalty, 20);
    assert.deepEqual(lenient?.facts, rubric.facts);
    assert.deepEqual(lenient?.citations, rubric.citations);
    const facts = rubricForTask(rubric, "facts");
    // facts is replaced whole: the top level's dropped and allow_dropped do not carry into the task's facts.
    assert.deepEqual(facts?.facts, { dropped: undefined, added: 0, allowDropped: [], allowAdded: [] });
    assert.equal(facts?.penalty, 10);
    assert.deepEqual(facts?.rules, rubric.rules);
  });

  it("inherits everything for a task that writes nothing, and carries no tasks of its own", () => {
    const empty = rubricForTask(rubric, "empty");
    assert.deepEqual(empty, rubricOf(TOP));
    assert.ok(empty);
    assert.equal("tasks" in empty, false);
  });

  it("throws for a task the rubric does not define, never falling back to the top level", () => {
    assert.throws(() => rubricForTask(rubric, "missing"), /missing/u);
    assert.throws(() => rubricForTask(undefined, "lenient"), /lenient/u);
    assert.throws(() => rubricForTask(rubricOf(TOP), "lenient"), /lenient/u);
  });

  it("lists every rule id with where it was written", () => {
    assert.deepEqual(rubricRuleEntries(rubric), [
      { path: "rules", id: "total-mismatch" },
      { path: "rules", id: "ai-tell" },
      { path: "tasks.lenient.rules", id: "total-mismatch" },
      { path: "tasks.lenient.rules", id: "kanji-ratio" },
    ]);
  });

  it("gives the rule ids each task's outputs are graded by", () => {
    assert.deepEqual([...taskRuleIds(rubric, "lenient")], ["total-mismatch", "ai-tell", "kanji-ratio"]);
    assert.deepEqual([...taskRuleIds(rubric, "facts")], ["total-mismatch", "ai-tell"]);
    assert.deepEqual([...taskRuleIds(rubric, undefined)], ["total-mismatch", "ai-tell"]);
    assert.deepEqual([...taskRuleIds(undefined, undefined)], []);
  });
});

const vocabulary = (tasks?: readonly string[]): ItemVocabulary => ({ isLanguage: () => true, genres: [], tasks });

const itemProblems = (text: string, tasks?: readonly string[]): string[] => {
  const parsed = parseItems(text, vocabulary(tasks));
  return "problems" in parsed ? parsed.problems.map((problem) => `${String(problem.line)}:${problem.kind}:${problem.detail ?? ""}`) : [];
};

describe("an item's task", () => {
  it("is read when the rubric defines it, and absent from an item that names none", () => {
    const parsed = parseItems(jsonl({ id: "a", output: "x", task: "extract" }, { id: "b", output: "y" }), vocabulary(["extract"]));
    assert.ok("items" in parsed);
    assert.equal(parsed.items[0]?.task, "extract");
    assert.equal("task" in (parsed.items[1] ?? {}), false);
  });

  it("is an input problem, on its line, when the rubric does not define it", () => {
    assert.deepEqual(itemProblems(jsonl({ id: "a", output: "x" }, { id: "b", output: "y", task: "sumary" }), ["summary"]), ["2:unknown-task:sumary"]);
    assert.deepEqual(itemProblems(jsonl({ id: "a", output: "x", task: "summary" })), ["1:unknown-task:summary"]);
    assert.deepEqual(itemProblems(jsonl({ id: "a", output: "x", task: "summary" }), []), ["1:unknown-task:summary"]);
  });

  it("is an input problem when it is not a non-empty string", () => {
    [3, "", null, ["summary"], { name: "summary" }, true].forEach((task) =>
      assert.deepEqual(itemProblems(jsonl({ id: "a", output: "x", task }), ["summary"]), ["1:not-string:task"], JSON.stringify(task)),
    );
  });
});

const QUOTE = "# Quote\n\n| Item | Price |\n| --- | --- |\n| Design | $400 |\n| Build | $1,200 |\n| Total | $1,500 |\n";
const GRADE_ARGS = ["grade", "items.jsonl", "--experimental", "--out", "out.jsonl"];
const TASK_RUBRIC_YAML = [
  "rules:",
  "  total-mismatch: { max: 0 }",
  "tasks:",
  "  lenient:",
  "    rules:",
  "      total-mismatch: { max: 5 }",
  "  strict: ~",
  "",
].join("\n");
const indented = (yaml: string): string =>
  yaml
    .split("\n")
    .map((line) => (line === "" ? "" : `  ${line}`))
    .join("\n");
const TASK_ITEMS = jsonl({ id: "s", output: QUOTE, task: "strict" }, { id: "l", output: QUOTE, task: "lenient" }, { id: "n", output: QUOTE });

const outcome = (results: readonly GradeResult[]): unknown[] => results.map((result) => [result.id, result.task, result.pass]);

const withoutStamp = (results: readonly GradeResult[]): unknown[] => results.map(({ stamp: __stamp, ...rest }) => rest);

describe("chaff grade with tasks", () => {
  it("grades each item by its task's rubric, from chaff.yaml and from a --rubric file alike, and records the task", async () => {
    const inConfig = await runCli({ "items.jsonl": TASK_ITEMS, "chaff.yaml": `grade:\n${indented(TASK_RUBRIC_YAML)}` }, GRADE_ARGS, "en_US.UTF-8");
    const inFile = await runCli({ "items.jsonl": TASK_ITEMS, "r.yaml": TASK_RUBRIC_YAML }, [...GRADE_ARGS, "--rubric", "r.yaml"], "en_US.UTF-8");
    [inConfig, inFile].forEach((run) => {
      assert.equal(run.code, 1, run.both);
      const results = resultsIn(run.dir);
      assert.deepEqual(outcome(results), [
        ["s", "strict", false],
        ["l", "lenient", true],
        ["n", undefined, false],
      ]);
      assert.equal("task" in (results[2] ?? {}), false);
    });
    assert.deepEqual(withoutStamp(resultsIn(inFile.dir)), withoutStamp(resultsIn(inConfig.dir)));
  });

  it("grades an item without a task exactly as the same rubric without tasks does", async () => {
    const plain = jsonl({ id: "n", output: QUOTE }, { id: "m", output: "A short note." });
    const top = "rules:\n  total-mismatch: { max: 0 }\n";
    const without = await runCli({ "items.jsonl": plain, "r.yaml": top }, [...GRADE_ARGS, "--rubric", "r.yaml"], "en_US.UTF-8");
    const withTasks = await runCli({ "items.jsonl": plain, "r.yaml": TASK_RUBRIC_YAML }, [...GRADE_ARGS, "--rubric", "r.yaml"], "en_US.UTF-8");
    assert.deepEqual(withoutStamp(resultsIn(withTasks.dir)), withoutStamp(resultsIn(without.dir)));
  });

  it("stamps another settings hash when only a task's rubric changes, in chaff.yaml or in a file", async () => {
    const changed = TASK_RUBRIC_YAML.replace("max: 5", "max: 6");
    const settingsOf = async (files: Readonly<Record<string, string>>, args: readonly string[]): Promise<string | undefined> =>
      resultsIn((await runCli({ "items.jsonl": TASK_ITEMS, ...files }, [...GRADE_ARGS, ...args], "en_US.UTF-8")).dir)[0]?.stamp.settings;
    // One run at a time: a run changes the working directory and console.
    const configBefore = await settingsOf({ "chaff.yaml": `grade:\n${indented(TASK_RUBRIC_YAML)}` }, []);
    const configAfter = await settingsOf({ "chaff.yaml": `grade:\n${indented(changed)}` }, []);
    const fileBefore = await settingsOf({ "r.yaml": TASK_RUBRIC_YAML }, ["--rubric", "r.yaml"]);
    const fileAfter = await settingsOf({ "r.yaml": changed }, ["--rubric", "r.yaml"]);
    assert.ok(configBefore !== undefined && fileBefore !== undefined);
    assert.notEqual(configBefore, configAfter);
    assert.notEqual(fileBefore, fileAfter);
  });

  const stops = async (items: string, lang = "en_US.UTF-8"): Promise<string> => {
    const run = await runCli({ "items.jsonl": items, "r.yaml": TASK_RUBRIC_YAML }, ["grade", "items.jsonl", "--rubric", "r.yaml"], lang);
    assert.equal(run.code, 2, run.both);
    assert.equal(run.out, "");
    return run.err;
  };

  it("ends with 2 on an unknown task or a task that is not a string, naming the line and the field", async () => {
    assert.match(
      await stops(jsonl({ id: "a", output: "x" }, { id: "b", output: "y", task: "summary" })),
      /^items\.jsonl: line 2: task "summary" is not among/mu,
    );
    assert.match(await stops(jsonl({ id: "a", output: "x", task: 1 })), /^items\.jsonl: line 1: task must be a string/mu);
    assert.match(
      await stops(jsonl({ id: "a", output: "x", task: "summary" }), "ja_JP.UTF-8"),
      /^items\.jsonl: 1 行目: task "summary" は採点基準の tasks にありません/mu,
    );
  });

  it("ends with 2 on an item's task when the run has no tasks at all", async () => {
    const run = await runCli({ "items.jsonl": jsonl({ id: "a", output: "x", task: "strict" }) }, ["grade", "items.jsonl"], "en_US.UTF-8");
    assert.equal(run.code, 2, run.both);
    assert.match(run.err, /task "strict" is not among/u);
  });

  it("does not let task name the variant field", async () => {
    const run = await runCli({ "items.jsonl": jsonl({ id: "a", output: "x", task: "a" }) }, ["grade", "items.jsonl", "--variant-key", "task"], "en_US.UTF-8");
    assert.equal(run.code, 2);
    assert.match(run.err, /usage: chaff grade/u);
  });

  it("says once where an unknown rule id in a task was written", async () => {
    const rubric = `${TASK_RUBRIC_YAML}  other:\n    rules:\n      no-such-rule: { max: 0 }\n`;
    const run = await runCli(
      { "items.jsonl": jsonl({ id: "a", output: "x" }), "r.yaml": rubric },
      ["grade", "items.jsonl", "--rubric", "r.yaml"],
      "en_US.UTF-8",
    );
    assert.match(run.err, /^r\.yaml: tasks\.other\.rules\.no-such-rule: /mu);
  });
});
