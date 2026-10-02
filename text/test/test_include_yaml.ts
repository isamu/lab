import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { collectTargets } from "../packages/chaff/src/files.ts";
import { targetsOf, withIncludes } from "../packages/chaff/src/cli-args.ts";
import { loadConfig } from "../packages/chaff/src/config/load.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { isYamlPath, outsideValues, valuesText, yamlValueSpans } from "../packages/chaff/src/yaml-values.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { runCli } from "./cli-run.ts";

// A directory walk takes the files include names besides Markdown, and a YAML file is checked by its string values,
// each where it stands in the file, keys and comments left out.

const valuesOf = (source: string): string[] | undefined => yamlValueSpans(source)?.map((span) => source.slice(span.start, span.end));

describe("yamlValueSpans", () => {
  it("takes string values, not keys, quotes, comments, numbers or booleans", () => {
    const source = "# a comment\nname: report # trailing\ncount: 3\non: true\nempty: null\nquoted: \"TODO: fill\"\nsingle: 'it''s'\n";
    assert.deepEqual(valuesOf(source), ["report", "TODO: fill", "it''s"]);
  });

  it("takes sequence items and nested maps", () => {
    const source = "expected:\n  - first value\n  - 'second value'\nnested:\n  deeper:\n    key: deep value\nflow: [a, \"b c\"]\n";
    assert.deepEqual(valuesOf(source), ["first value", "second value", "deep value", "a", "b c"]);
  });

  it("takes a block scalar's lines, not its header", () => {
    const literal = "notes: |\n  One line.\n  Two lines.\nnext: x\n";
    assert.deepEqual(valuesOf(literal), ["  One line.\n  Two lines.", "x"]);
    const folded = "notes: >-\n  Folded text\n  goes on.\n";
    assert.deepEqual(valuesOf(folded), ["  Folded text\n  goes on."]);
  });

  it("reads every document of a multi-document file", () => {
    assert.deepEqual(valuesOf("a: first\n---\nb: second\n"), ["first", "second"]);
  });

  it("gives nothing for an empty file or one with only keys and numbers", () => {
    assert.deepEqual(valuesOf(""), []);
    assert.deepEqual(valuesOf("a: 1\nb: 2.5\n"), []);
  });

  it("gives up on a file that is not valid YAML", () => {
    assert.equal(yamlValueSpans("a: [\n"), undefined);
    assert.equal(yamlValueSpans("a: 1\na: 2\n"), undefined);
  });
});

describe("valuesText and outsideValues", () => {
  it("keeps every offset and line break, blanking the rest", () => {
    const source = 'key: "value here"\nlist:\n  - item\n';
    const values = yamlValueSpans(source) ?? [];
    const text = valuesText(source, values);
    assert.equal(text.length, source.length);
    assert.equal(text.split("\n").length, source.split("\n").length);
    assert.equal(text.trim().replace(/\s+/gu, " "), "value here item");
  });

  it("covers everything between the values, and nothing when the values cover all", () => {
    assert.deepEqual(outsideValues([{ start: 2, end: 4 }], 6), [
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
    assert.deepEqual(outsideValues([{ start: 0, end: 6 }], 6), []);
    assert.deepEqual(outsideValues([], 3), [{ start: 0, end: 3 }]);
  });
});

describe("isYamlPath", () => {
  it("knows .yaml and .yml in any case, and nothing else", () => {
    assert.deepEqual(["a.yaml", "b.YML", "c.yml", "d.md", "e.txt", "yaml", "f.yaml.md"].map(isYamlPath), [true, true, true, false, false, false, false]);
  });
});

describe("a YAML file as a document", () => {
  const FIXTURE = [
    "# TODO: a comment is not a value",
    "name: collect-reports",
    "expected_output_contains:",
    '  - "TODO: add expected output pattern"',
    "  - second value",
    "notes: |",
    "  A block value that is",
    "  written over two lines.",
    "",
  ].join("\n");

  it("reads each value as its own sentence, indentation and all", () => {
    const doc = buildDocument("case.yaml", FIXTURE, en);
    assert.deepEqual(
      doc.sentences.map((sentence) => sentence.text),
      ["collect-reports", "TODO: add expected output pattern", "second value", "A block value that is\n  written over two lines."],
    );
  });

  it("leaves keys and comments out of the prose the rules read", () => {
    const prose = buildDocument("case.yaml", FIXTURE, en).prose ?? "";
    assert.equal(prose.length, FIXTURE.length);
    assert.doesNotMatch(prose, /name:|expected_output_contains|a comment/u);
    assert.match(prose, /TODO: add expected output pattern/u);
  });

  it("keeps the file's own offsets", () => {
    const doc = buildDocument("case.yaml", FIXTURE, en);
    const todo = doc.sentences.find((sentence) => sentence.text.startsWith("TODO"));
    assert.ok(todo !== undefined);
    assert.equal(FIXTURE.slice(todo.span.start, todo.span.end), "TODO: add expected output pattern");
  });

  it("reads the same text as plain text when it is not YAML, or not named .yaml", () => {
    const keysToo = (path: string, source: string): boolean =>
      buildDocument(path, source, en).sentences.some((sentence) => sentence.text.includes("expected_output_contains"));
    assert.ok(keysToo("case.txt", FIXTURE));
    assert.ok(keysToo("case.yaml", `${FIXTURE}bad: [\n`));
    assert.ok(!keysToo("case.yaml", FIXTURE));
  });
});

const tree = (): string => {
  const root = mkdtempSync(join(tmpdir(), "chaff-include-"));
  mkdirSync(join(root, "fixtures", "deep"), { recursive: true });
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "README.md"), "# a\n");
  writeFileSync(join(root, "fixtures", "one.yaml"), "a: b\n");
  writeFileSync(join(root, "fixtures", "deep", "two.yaml"), "a: b\n");
  writeFileSync(join(root, "fixtures", "three.yml"), "a: b\n");
  writeFileSync(join(root, "fixtures", "notes.txt"), "a\n");
  writeFileSync(join(root, "node_modules", "skip.yaml"), "a: b\n");
  return root;
};

const names = (paths: readonly string[]): Set<string> => new Set(paths.map((path) => basename(path)));

describe("collectTargets with include", () => {
  it("walks Markdown only without include", () => {
    assert.deepEqual(names(collectTargets([tree()])), new Set(["README.md"]));
  });

  it("adds the files a glob names, at any depth, and still skips node_modules", () => {
    assert.deepEqual(names(collectTargets([tree()], ["*.yaml"])), new Set(["README.md", "one.yaml", "two.yaml"]));
    assert.deepEqual(names(collectTargets([tree()], ["*.yaml", "*.yml", "*.txt"])), new Set(["README.md", "one.yaml", "two.yaml", "three.yml", "notes.txt"]));
  });

  it("matches a glob with a folder in it below the folder walked", () => {
    assert.deepEqual(names(collectTargets([tree()], ["deep/*.yaml"])), new Set(["README.md", "two.yaml"]));
  });

  it("keeps a glob target's matches when include names them", () => {
    const root = tree();
    assert.deepEqual(names(collectTargets([join(root, "fixtures", "*")])), new Set());
    assert.deepEqual(names(collectTargets([join(root, "fixtures", "*")], ["*.yaml"])), new Set(["one.yaml"]));
  });

  it("checks a file named directly whatever its extension", () => {
    const root = tree();
    assert.deepEqual(names(collectTargets([join(root, "fixtures", "one.yaml")])), new Set(["one.yaml"]));
  });
});

describe("--include and include in chaff.yaml", () => {
  it("adds each --include to chaff.yaml's include", () => {
    const config = withIncludes({ include: ["*.txt"] }, ["lint", "docs", "--include", "*.yaml", "--include", "*.{yml,json}"]);
    assert.deepEqual(config.include, ["*.txt", "*.yaml", "*.{yml,json}"]);
  });

  it("leaves the settings as they are without --include, and ignores a flag with no value", () => {
    const config = { include: ["*.txt"] };
    assert.equal(withIncludes(config, ["docs"]), config);
    assert.equal(withIncludes(config, ["docs", "--include"]), config);
    assert.equal(withIncludes(config, ["docs", "--include", "--compact"]), config);
  });

  it("does not take the glob after --include as a file to check", () => {
    assert.deepEqual(targetsOf(["docs", "--include", "*.yaml", "a.md"]), ["docs", "a.md"]);
  });

  it("reads include from chaff.yaml as one glob or a list", () => {
    const configFrom = (yaml: string) => {
      const path = join(mkdtempSync(join(tmpdir(), "chaff-include-config-")), "chaff.yaml");
      writeFileSync(path, yaml);
      return loadConfig(path);
    };
    assert.deepEqual(configFrom('include: "*.yaml"\n').include, ["*.yaml"]);
    assert.deepEqual(configFrom('include: ["*.yaml", "*.txt"]\n').include, ["*.yaml", "*.txt"]);
    assert.deepEqual(configFrom("genre: blog/tech\n").include, []);
  });
});

const CUSTOM = [
  "language: en",
  "custom_rules:",
  "  - id: todo-fixture",
  "    type: pattern",
  "    pattern: 'TODO:'",
  "    level: error",
  "    name: Scaffolded fixture",
  "    why: A fixture that asserts nothing passes.",
  "    how_to_fix: Write the expected output.",
  "    example:",
  "      before: 'TODO: add expected output pattern'",
  "      after: 'Returns a table of three rows'",
  "",
].join("\n");

const FIXTURE_FILE = '# TODO: not this one\nname: todo-key\nexpected_output_contains:\n  - "TODO: add expected output pattern"\n';

describe("the command line on a folder of YAML", () => {
  it("says what it looked for and how to add more, in English and Japanese", async () => {
    const english = await runCli({ "fixtures/a.yaml": FIXTURE_FILE }, ["fixtures/"], "en_US.UTF-8");
    assert.equal(english.code, 1);
    assert.match(
      english.err,
      /^No files to check found: fixtures\/\n {2}Looked for Markdown \(\.md, \.markdown, \.mdx\)\. .*include: \["\*\.yaml"\].*--include "\*\.yaml"/u,
    );
    const japanese = await runCli({ "fixtures/a.yaml": FIXTURE_FILE }, ["fixtures/"]);
    assert.match(
      japanese.err,
      /^検査するファイルが 1 つも見つかりませんでした: fixtures\/\n {2}探したもの: Markdown（\.md \.markdown \.mdx）。.*--include "\*\.yaml"/u,
    );
  });

  it("names the globs it looked for when include found nothing", async () => {
    const run = await runCli({ "fixtures/a.json": "{}" }, ["fixtures/", "--include", "*.yaml"], "en_US.UTF-8");
    assert.match(run.err, /Looked for Markdown \(\.md, \.markdown, \.mdx\) and \*\.yaml\./u);
  });

  it("runs a custom pattern rule on the values with --include, at the file's line and column", async () => {
    const run = await runCli({ "chaff.yaml": CUSTOM, "fixtures/a.yaml": FIXTURE_FILE }, ["fixtures/", "--include", "*.yaml", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /4:6 +error +Scaffolded fixture: "TODO:"/u);
    assert.doesNotMatch(run.out, /^ {2}1:/mu, "the comment is not a value");
  });

  it("takes include from chaff.yaml the same way", async () => {
    const run = await runCli({ "chaff.yaml": `${CUSTOM}include: ["*.yaml"]\n`, "fixtures/a.yaml": FIXTURE_FILE }, ["fixtures/", "--compact"], "en_US.UTF-8");
    assert.match(run.out, /4:6 +error +Scaffolded fixture/u);
  });
});
