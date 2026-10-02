import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { readYamlFile, YamlFileError, yamlFileProblem, yamlSyntaxOf } from "../packages/chaff/src/config/yaml-file.ts";
import { runCli } from "./cli-run.ts";

// A chaff.yaml or checks.yaml that is not YAML stops the run with the file, the line and column, and the parser's sentence,
// in the person's language. No stack trace.

const BROKEN: readonly { readonly label: string; readonly yaml: string; readonly line: number; readonly column: number; readonly detail: RegExp }[] = [
  { label: "an unclosed flow sequence", yaml: "rules:\n  max-sentence-length: [\n", line: 3, column: 1, detail: /Flow sequence/u },
  { label: "a duplicated key", yaml: "genre: blog/tech\ngenre: business/email\n", line: 2, column: 1, detail: /unique/u },
  { label: "an unclosed quote", yaml: 'genre: "blog/tech\n', line: 2, column: 1, detail: /quote/u },
  { label: "a tab as indentation", yaml: "rules:\n\tmax-sentence-length: strict\n", line: 2, column: 1, detail: /Tabs/u },
  { label: "items at two columns", yaml: "jargon:\n  - a\n b: 1\n", line: 3, column: 1, detail: /same column/u },
];

const throwing = (yaml: string): unknown => {
  try {
    parse(yaml);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe("yamlSyntaxOf", () => {
  BROKEN.forEach(({ label, yaml, line, column, detail }) => {
    it(`gives the position and the parser's sentence for ${label}`, () => {
      const syntax = yamlSyntaxOf(throwing(yaml));
      assert.ok(syntax !== undefined);
      assert.equal(syntax.line, line);
      assert.equal(syntax.column, column);
      assert.match(syntax.detail, detail);
      assert.doesNotMatch(syntax.detail, /at line|\n/u, "the position is said once, by chaff");
    });
  });

  const notSyntax: readonly (readonly [string, unknown])[] = [
    ["a plain Error", new Error("ENOENT")],
    ["a string", "Flow sequence at line 3, column 1"],
    ["undefined", undefined],
    ["null", null],
    ["an object shaped like the error", { name: "YAMLParseError", linePos: [{ line: 1, col: 1 }], message: "x" }],
  ];
  notSyntax.forEach(([label, value]) => {
    it(`is undefined for ${label}`, () => {
      assert.equal(yamlSyntaxOf(value), undefined);
    });
  });
});

const fileWith = (name: string, body: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "chaff-yaml-")), name);
  writeFileSync(path, body);
  return path;
};

describe("readYamlFile", () => {
  it("reads valid YAML, an empty file included", () => {
    assert.deepEqual(readYamlFile(fileWith("chaff.yaml", "genre: blog/tech\n")), { genre: "blog/tech" });
    assert.equal(readYamlFile(fileWith("chaff.yaml", "")), null);
  });

  it("throws a YamlFileError naming the file for a syntax error", () => {
    const path = fileWith("chaff.yaml", "rules:\n  max-sentence-length: [\n");
    assert.throws(
      () => readYamlFile(path),
      (error: unknown) => error instanceof YamlFileError && error.path === path && error.syntax.line === 3,
    );
  });

  it("lets a missing file fail as it did", () => {
    assert.throws(
      () => readYamlFile(join(tmpdir(), "chaff-no-such-dir", "chaff.yaml")),
      (error: unknown) => !(error instanceof YamlFileError),
    );
  });
});

describe("yamlFileProblem", () => {
  const syntax = { line: 3, column: 1, detail: "Map keys must be unique" };
  it("names the file and the position in Japanese", () => {
    assert.equal(yamlFileProblem("chaff.yaml", syntax, "ja"), "chaff: chaff.yaml の 3 行目 1 桁目が YAML として読めません: Map keys must be unique");
  });
  it("names the file and the position in English", () => {
    assert.equal(yamlFileProblem("chaff.yaml", syntax, "en"), "chaff: chaff.yaml, line 3, column 1, is not valid YAML: Map keys must be unique");
  });
});

const DOC = "# t\n\n本文です。\n";

describe("the command line on a chaff.yaml that is not YAML", () => {
  BROKEN.forEach(({ label, yaml, line, column }) => {
    it(`stops with exit code 1 and the position for ${label}`, async () => {
      const run = await runCli({ "chaff.yaml": yaml, "t.md": DOC }, ["t.md"]);
      assert.equal(run.code, 1);
      assert.match(run.err, new RegExp(`^chaff: chaff\\.yaml の ${line} 行目 ${column} 桁目が YAML として読めません: `, "u"));
      assert.doesNotMatch(run.err, /YAMLParseError|node_modules|\n {4}at /u);
      assert.equal(run.out, "");
    });
  });

  it("speaks English on an English terminal", async () => {
    const run = await runCli({ "chaff.yaml": "genre: [\n", "t.md": DOC }, ["t.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /^chaff: chaff\.yaml, line \d+, column \d+, is not valid YAML: /u);
  });

  it("stops the subcommands that read chaff.yaml too", async () => {
    const run = await runCli({ "chaff.yaml": "rules:\n  a: [\n" }, ["rules"]);
    assert.equal(run.code, 1);
    assert.match(run.err, /chaff\.yaml の 3 行目/u);
  });

  it("stops chaff test on a checks.yaml that is not YAML", async () => {
    const run = await runCli({ "checks.yaml": "checks:\n  - name: a\n    check: [\n", "t.md": DOC }, ["test", "t.md", "--dry-run"]);
    assert.equal(run.code, 1);
    assert.match(run.err, /^chaff: checks\.yaml の \d+ 行目 \d+ 桁目が YAML として読めません: /mu);
  });

  it("still runs on a chaff.yaml that is valid", async () => {
    const run = await runCli({ "chaff.yaml": "genre: blog/tech\n", "t.md": DOC }, ["t.md"]);
    assert.doesNotMatch(run.err, /YAML/u);
  });
});
