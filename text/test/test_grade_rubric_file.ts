import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRubric } from "../packages/chaff/src/grade/rubric.ts";
import { filePathOf, parseRubricFile } from "../packages/chaff/src/grade/rubric-file.ts";
import type { GradeResult } from "../packages/chaff/src/grade/result.ts";
import { runCli } from "./cli-run.ts";
import { jsonl, resultsIn } from "./grade-run.ts";

// `chaff grade --rubric <file>`: the schema of chaff.yaml's grade: at a file's top level, replacing grade: for the run.

const RUBRIC = {
  rules: { "total-mismatch": { max: 0 }, "ai-tell": { max_rate: 5, weight: 2 } },
  facts: { dropped: 0, allow_dropped: ["heading"] },
  penalty: 10,
};

const RUBRIC_YAML = [
  "rules:",
  "  total-mismatch: { max: 0 }",
  "  ai-tell: { max_rate: 5, weight: 2 }",
  "facts:",
  "  dropped: 0",
  "  allow_dropped: [heading]",
  "penalty: 10",
  "",
].join("\n");

const problemsOf = (path: string, content: string): string[] => {
  const parsed = parseRubricFile(path, content);
  if (!("problems" in parsed)) return [];
  return parsed.problems.map((problem) => (problem.kind === "rubric" ? `${problem.problem.path}:${problem.problem.expected}` : problem.kind));
};

describe("reading a rubric file", () => {
  it("reads YAML (.yaml, .yml) and JSON as the same rubric grade: gives", () => {
    const expected = parseRubric(RUBRIC);
    assert.ok("rubric" in expected);
    ["rubric.yaml", "rubric.yml", "RUBRIC.YAML"].forEach((path) => {
      const parsed = parseRubricFile(path, RUBRIC_YAML);
      assert.ok("rubric" in parsed, path);
      assert.deepEqual(parsed.rubric, expected.rubric);
    });
    const json = parseRubricFile("rubric.json", JSON.stringify(RUBRIC));
    assert.ok("rubric" in json);
    assert.deepEqual(json.rubric, expected.rubric);
  });

  it("is an empty rubric when the file is empty or null, as a bare grade: is", () => {
    [parseRubricFile("r.yaml", ""), parseRubricFile("r.yaml", "# nothing yet\n"), parseRubricFile("r.json", "null")].forEach((parsed) => {
      assert.ok("rubric" in parsed);
      assert.deepEqual(parsed.rubric, { rules: {} });
    });
  });

  it("names every problem by its path from the file's top level", () => {
    assert.deepEqual(problemsOf("r.yaml", "rules:\n  ai-tell: { max_rte: 3 }\n"), ["rules.ai-tell.max_rte:known-key"]);
    assert.deepEqual(problemsOf("r.json", '{ "penalty": "10", "facts": { "dropped": -1 } }'), ["facts.dropped:count", "penalty:number"]);
    assert.deepEqual(problemsOf("r.yaml", "- rules\n"), [":map"]);
    assert.deepEqual(problemsOf("r.json", '{ "rules": '), ["syntax"]);
    assert.deepEqual(problemsOf("r.yaml", "rules: [\n"), ["syntax"]);
    assert.deepEqual(problemsOf("r.toml", "penalty = 10\n"), ["format"]);
    assert.deepEqual(problemsOf("rubric", RUBRIC_YAML), ["format"]);
  });

  it("drops only the leading grade of a path", () => {
    assert.deepEqual(["grade", "grade.rules.grade.max", "grade.penalty"].map(filePathOf), ["", "rules.grade.max", "penalty"]);
  });

  it("digests the file's bytes, so another rubric or another spelling of it is another digest", () => {
    const digestOf = (content: string): string => {
      const parsed = parseRubricFile("r.yaml", content);
      assert.ok("rubric" in parsed);
      return parsed.digest;
    };
    assert.equal(digestOf(RUBRIC_YAML), digestOf(RUBRIC_YAML));
    assert.notEqual(digestOf(RUBRIC_YAML), digestOf(RUBRIC_YAML.replace("penalty: 10", "penalty: 20")));
    assert.match(digestOf(RUBRIC_YAML), /^sha256:[0-9a-f]{64}$/u);
  });
});

const QUOTE = "# Quote\n\n| Item | Price |\n| --- | --- |\n| Design | $400 |\n| Build | $1,200 |\n| Total | $1,500 |\n";
const ITEMS = jsonl({ id: "wrong-total", output: QUOTE }, { id: "plain", output: "A short note." });
const GRADE_ARGS = ["grade", "items.jsonl", "--experimental", "--out", "out.jsonl"];

/** A result without its stamp (asserted on its own below): what the rubric decided. */
const verdicts = (results: readonly GradeResult[]): unknown[] => results.map(({ stamp: __stamp, ...rest }) => rest);

describe("chaff grade --rubric", () => {
  it("grades by a YAML or JSON file exactly as by the same rubric written under grade:", async () => {
    const yamlRubric = `grade:\n${RUBRIC_YAML.split("\n")
      .map((line) => (line === "" ? "" : `  ${line}`))
      .join("\n")}`;
    const inConfig = await runCli({ "items.jsonl": ITEMS, "chaff.yaml": yamlRubric }, GRADE_ARGS, "en_US.UTF-8");
    const fromYaml = await runCli({ "items.jsonl": ITEMS, "rubric.yaml": RUBRIC_YAML }, [...GRADE_ARGS, "--rubric", "rubric.yaml"], "en_US.UTF-8");
    const fromJson = await runCli({ "items.jsonl": ITEMS, "rubric.json": JSON.stringify(RUBRIC) }, [...GRADE_ARGS, "--rubric", "rubric.json"], "en_US.UTF-8");
    assert.deepEqual([inConfig.code, fromYaml.code, fromJson.code], [1, 1, 1]);
    const expected = verdicts(resultsIn(inConfig.dir));
    assert.deepEqual(verdicts(resultsIn(fromYaml.dir)), expected);
    assert.deepEqual(verdicts(resultsIn(fromJson.dir)), expected);
    // The summary is the same up to the stamp, whose settings hash names the file rather than grade:.
    const beforeStamp = (out: string): string => out.slice(0, out.indexOf("\n  settings sha256:"));
    assert.equal(beforeStamp(fromYaml.out), beforeStamp(inConfig.out));
  });

  it("replaces chaff.yaml's grade: for the run", async () => {
    const files = {
      "items.jsonl": ITEMS,
      "chaff.yaml": "grade:\n  rules:\n    total-mismatch: { max: 0 }\n",
      "lenient.yaml": "rules:\n  total-mismatch: { max: 5 }\n",
    };
    const byConfig = await runCli(files, GRADE_ARGS, "en_US.UTF-8");
    const byFile = await runCli(files, [...GRADE_ARGS, "--rubric", "lenient.yaml"], "en_US.UTF-8");
    assert.deepEqual([byConfig.code, byFile.code], [1, 0]);
  });

  it("stamps another settings hash for another rubric file, and --baseline refuses to compare across them", async () => {
    const first = await runCli({ "items.jsonl": ITEMS, "a.yaml": "penalty: 10\n" }, [...GRADE_ARGS, "--rubric", "a.yaml"], "en_US.UTF-8");
    const same = await runCli({ "items.jsonl": ITEMS, "a.yaml": "penalty: 10\n" }, [...GRADE_ARGS, "--rubric", "a.yaml"], "en_US.UTF-8");
    const other = await runCli({ "items.jsonl": ITEMS, "a.yaml": "penalty: 20\n" }, [...GRADE_ARGS, "--rubric", "a.yaml"], "en_US.UTF-8");
    const [a, b, c] = [first, same, other].map((run) => resultsIn(run.dir)[0]?.stamp);
    assert.equal(a?.settings, b?.settings);
    assert.equal(a?.rules, c?.rules);
    assert.notEqual(a?.settings, c?.settings);
    const before = readFileSync(join(first.dir, "out.jsonl"), "utf8");
    const files = { "items.jsonl": ITEMS, "base.jsonl": before };
    const matched = await runCli(
      { ...files, "a.yaml": "penalty: 10\n" },
      ["grade", "items.jsonl", "--experimental", "--rubric", "a.yaml", "--baseline", "base.jsonl"],
      "en_US.UTF-8",
    );
    const mismatched = await runCli(
      { ...files, "a.yaml": "penalty: 20\n" },
      ["grade", "items.jsonl", "--experimental", "--rubric", "a.yaml", "--baseline", "base.jsonl"],
      "en_US.UTF-8",
    );
    assert.equal(matched.code, 0, matched.err);
    assert.equal(mismatched.code, 2);
    assert.equal(mismatched.out, "");
  });

  it("stamps a rubric file otherwise than no rubric and than grade:", async () => {
    const none = await runCli({ "items.jsonl": ITEMS }, GRADE_ARGS, "en_US.UTF-8");
    const config = await runCli({ "items.jsonl": ITEMS, "chaff.yaml": "grade:\n  penalty: 10\n" }, GRADE_ARGS, "en_US.UTF-8");
    const file = await runCli({ "items.jsonl": ITEMS, "a.yaml": "penalty: 10\n" }, [...GRADE_ARGS, "--rubric", "a.yaml"], "en_US.UTF-8");
    const settings = new Set([none, config, file].map((run) => resultsIn(run.dir)[0]?.stamp.settings));
    assert.equal(settings.size, 3);
  });

  const stops = async (files: Readonly<Record<string, string>>, rubricArgs: readonly string[], lang = "en_US.UTF-8") => {
    const run = await runCli({ "items.jsonl": ITEMS, ...files }, ["grade", "items.jsonl", ...rubricArgs], lang);
    assert.equal(run.code, 2, run.both);
    assert.equal(run.out, "");
    return run.err;
  };

  it("ends with 2 on a misspelt key or a wrong type, naming the file and the dotted path", async () => {
    assert.match(
      await stops({ "r.yaml": "rules:\n  ai-tell: { max_rte: 3 }\n" }, ["--rubric", "r.yaml"]),
      /^r\.yaml: rules\.ai-tell\.max_rte must be a key chaff knows/mu,
    );
    assert.match(
      await stops({ "r.json": '{ "facts": { "dropped": "none" } }' }, ["--rubric", "r.json"]),
      /^r\.json: facts\.dropped must be a whole number from 0/mu,
    );
    assert.match(await stops({ "r.yaml": "- 1\n" }, ["--rubric", "r.yaml"]), /^r\.yaml: the top level must be a map/mu);
    assert.match(await stops({ "r.yaml": "penalty: x\n" }, ["--rubric", "r.yaml"], "ja_JP.UTF-8"), /^r\.yaml の penalty は 0 以上の数で書いてください/mu);
  });

  it("ends with 2 on a missing file, bad JSON or YAML, or another extension, naming the file", async () => {
    assert.match(await stops({}, ["--rubric", "missing.yaml"]), /missing\.yaml/u);
    assert.match(await stops({ "r.json": '{ "rules": ' }, ["--rubric", "r.json"]), /^Could not read r\.json as a rubric/mu);
    assert.match(await stops({ "r.yaml": "rules: [\n" }, ["--rubric", "r.yaml"]), /^Could not read r\.yaml as a rubric/mu);
    assert.match(await stops({ "r.toml": "penalty = 1\n" }, ["--rubric", "r.toml"]), /^r\.toml: a --rubric file must end in/mu);
  });

  it("ends with 2 when --rubric names no file, rather than falling back to chaff.yaml", async () => {
    assert.match(await stops({}, ["--rubric"]), /usage: chaff grade/u);
    assert.match(await stops({}, ["--rubric", "--json"]), /usage: chaff grade/u);
  });

  it("does not read the items as the rubric file", async () => {
    const run = await runCli(
      { "items.jsonl": ITEMS, "r.yaml": "penalty: 10\n" },
      ["grade", "--rubric", "r.yaml", "items.jsonl", "--out", "out.jsonl"],
      "en_US.UTF-8",
    );
    assert.equal(run.code, 0, run.both);
    assert.equal(resultsIn(run.dir).length, 2);
  });
});
