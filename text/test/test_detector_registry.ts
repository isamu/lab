import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DETECTORS } from "../packages/chaff/src/detectors/index.ts";
import { registryEntries } from "../packages/chaff/src/detectors/registry-files.ts";
import { registrationsIn, registryFileText } from "../scripts/rule-registration.ts";

// 検出器は detectors/registry/<how_to_find>.ts の 1 ファイルずつで登録する。rule を足す PR が共有の一覧を書き換えないため。

const REGISTRY_DIR = join(import.meta.dirname, "..", "packages", "chaff", "src", "detectors", "registry");
const byName = (left: string, right: string): number => left.localeCompare(right, "en");
const RULES_DIR = join(import.meta.dirname, "..", "packages", "chaff", "rules");

describe("registryEntries", () => {
  it("src では .ts のファイルを、名前から拡張子を外した how_to_find として名前順に返す", () => {
    assert.deepEqual(registryEntries(["b-rule.ts", "a-rule.ts"], ".ts"), [
      { file: "a-rule.ts", howToFind: "a-rule" },
      { file: "b-rule.ts", howToFind: "b-rule" },
    ]);
  });

  it("dist では .js だけを数え、隣の .d.ts・.map は検出器にしない", () => {
    const names = ["a-rule.js", "a-rule.js.map", "a-rule.d.ts", "a-rule.d.ts.map"];
    assert.deepEqual(registryEntries(names, ".js"), [{ file: "a-rule.js", howToFind: "a-rule" }]);
  });

  it("src でも .d.ts は検出器にしない", () => {
    assert.deepEqual(registryEntries(["a-rule.d.ts"], ".ts"), []);
  });

  it("空の一覧・拡張子だけの名前・別の拡張子からは何も返さない", () => {
    assert.deepEqual(registryEntries([], ".ts"), []);
    assert.deepEqual(registryEntries([".ts", "README.md", "a-rule.tsx"], ".ts"), []);
  });
});

describe("DETECTORS", () => {
  it("registry/ のファイル 1 つにつき 1 つの how_to_find を持ち、値はどれも関数", () => {
    const files = readdirSync(REGISTRY_DIR).map((name) => name.replace(/\.ts$/u, ""));
    assert.deepEqual(Object.keys(DETECTORS).toSorted(byName), files.toSorted(byName));
    Object.entries(DETECTORS).forEach(([key, detector]) => assert.equal(typeof detector, "function", key));
  });

  it("同梱の rule が使う how_to_find は、検出器を持たないものを除いて引ける", () => {
    const used = readdirSync(RULES_DIR).flatMap((name) => /^how_to_find: (\S+)$/mu.exec(readFileSync(join(RULES_DIR, name), "utf8"))?.[1] ?? []);
    const missing = used.filter((key) => DETECTORS[key] === undefined).toSorted(byName);
    // 合成・AI 判定の rule は検出器を持たない。ここに増えたなら registry/ のファイルが足りていない。
    assert.deepEqual([...new Set(missing)], ["composite", "empty-conclusion", "risk-disclosure", "unsourced-number"]);
  });

  it("registry/ のファイルは migrate-rule-registration が書くのと同じ形をしている", () => {
    readdirSync(REGISTRY_DIR).forEach((file) => {
      const text = readFileSync(join(REGISTRY_DIR, file), "utf8");
      const [, name = "", module = ""] = /^import \{ (\w+) \} from "\.\.\/([^"]+)";$/mu.exec(text) ?? [];
      assert.equal(text, registryFileText({ howToFind: file.replace(/\.ts$/u, ""), name, module }), file);
    });
  });
});

describe("registrationsIn（手書きの DETECTORS の一覧を読む）", () => {
  const OLD_INDEX = [
    'import type { Detector } from "../plugin.ts";',
    'import { sentenceLength } from "./sentence-length.ts";',
    "import {",
    "  danglingReference,",
    "  dateOrder,",
    '} from "./structure-tree.ts";',
    "",
    "export const DETECTORS: Readonly<Record<string, Detector>> = {",
    '  "sentence-length": sentenceLength,',
    '  "dangling-reference": danglingReference,',
    "  hedging: dateOrder,",
    "};",
    "",
  ].join("\n");

  it("引用符つき・なしの鍵と、複数行の import の名前を、どのモジュールから来たかと一緒に読む", () => {
    assert.deepEqual(registrationsIn(OLD_INDEX), [
      { howToFind: "sentence-length", name: "sentenceLength", module: "sentence-length.ts" },
      { howToFind: "dangling-reference", name: "danglingReference", module: "structure-tree.ts" },
      { howToFind: "hedging", name: "dateOrder", module: "structure-tree.ts" },
    ]);
  });

  it("書いたファイルは、その名前をそのモジュールから import して detector として出す", () => {
    const [first] = registrationsIn(OLD_INDEX);
    assert.ok(first);
    assert.equal(
      registryFileText(first),
      'import type { Detector } from "../../plugin.ts";\nimport { sentenceLength } from "../sentence-length.ts";\n\nexport const detector: Detector = sentenceLength;\n',
    );
  });

  it("import していない名前を登録していれば止まり、鍵と名前を言う", () => {
    const broken = OLD_INDEX.replace("hedging: dateOrder", "hedging: hedging");
    assert.throws(() => registrationsIn(broken), /hedging.*"hedging"/u);
  });

  it("DETECTORS の一覧が無いファイル・空のファイルからは何も読まない", () => {
    assert.deepEqual(registrationsIn('import { a } from "./a.ts";\n'), []);
    assert.deepEqual(registrationsIn(""), []);
  });
});
