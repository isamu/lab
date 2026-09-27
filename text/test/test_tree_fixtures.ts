import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 見本の文書を木にして、期待する S 式（<名前>.sexp）と丸ごと比べる。期待する木は人が読んで確かめたもの。
// 見本を足したときは CHAFF_UPDATE_GOLDEN=1 で書き出し、中身を読んでから commit する。

const ROOT = fileURLToPath(new URL("./fixtures/structure", import.meta.url));
const ADAPTERS: Readonly<Record<string, LanguageAdapter>> = { ja, en };
const MARKDOWN = [".md"];
const SOURCES = [".md", ".txt"];
const UPDATE = process.env["CHAFF_UPDATE_GOLDEN"] === "1";

const fixtures = (language: string): string[] =>
  readdirSync(join(ROOT, language))
    .filter((name) => SOURCES.includes(extname(name)))
    .sort((left, right) => left.localeCompare(right, "en"));

const treeText = (language: string, name: string, adapter: LanguageAdapter): string => {
  if (adapter.structure === undefined) throw new Error(`${language} has no structure`);
  const source = readFileSync(join(ROOT, language, name), "utf8");
  const input = { path: `${language}/${name}`, source, language, markdown: MARKDOWN.includes(extname(name)) };
  return `${toSexp(buildStructure(input, adapter.structure))}\n`;
};

Object.entries(ADAPTERS).forEach(([language, adapter]) => {
  describe(`${language} documents as trees (golden)`, () => {
    // chaff tree と同じく、解析器を読み込んでから木にする。日本語の数量と日付は形態素で読む。
    before(async () => adapter.prepare?.({ pos: true }));
    fixtures(language).forEach((name) => {
      it(name, () => {
        const actual = treeText(language, name, adapter);
        const golden = join(ROOT, language, name.replace(/\.[a-z]+$/u, ".sexp"));
        if (UPDATE) writeFileSync(golden, actual);
        assert.equal(actual, readFileSync(golden, "utf8"));
      });
    });
  });
});
