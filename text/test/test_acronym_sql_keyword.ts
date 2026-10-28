import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// SQL のキーワード（VIEW、WHERE）は大文字で書くが略語ではなく、展開するものが無い。言語パッケージの語彙表 sql-keyword が持つ。例文は自作。

const LEXICON = "sql-keyword";

const keywordsOf = (adapter: LanguageAdapter): string[] => (adapter.lexicons[LEXICON] ?? []).map((entry) => entry.pattern);

const without = (adapter: LanguageAdapter, word: string): LanguageAdapter => ({
  ...adapter,
  lexicons: { ...adapter.lexicons, [LEXICON]: (adapter.lexicons[LEXICON] ?? []).filter((entry) => entry.pattern !== word) },
});

const usage = (adapter: LanguageAdapter, word: string): string =>
  adapter.id === "ja" ? `# 規約\n\n${word} は表に対して使います。SREも見ます。\n` : `# Rules\n\nUse a ${word} on the table. The SRE joins.\n`;

/** 略語として数えられる長さの語だけ（TRUNCATE や ROLLBACK は長すぎて、もともと数えない）。 */
const MAX_COUNTED_LETTERS = 6;
const countable = (word: string): boolean => word.length <= MAX_COUNTED_LETTERS;

[en, ja].forEach((adapter) => {
  describe(`sql-keyword（${adapter.id}）`, () => {
    it("語彙表があり、語は大文字だけ", () => {
      const keywords = keywordsOf(adapter);
      assert.ok(keywords.includes("VIEW"));
      assert.deepEqual(
        keywords.filter((word) => !/^[A-Z]+$/u.test(word)),
        [],
      );
    });

    it("どのキーワードも数えず、SRE は数える", () => {
      keywordsOf(adapter).forEach((word) => assert.deepEqual(reportedAcronyms(adapter, usage(adapter, word)), ["SRE"], word));
    });

    it("語彙表から抜いたキーワードは数える", () => {
      keywordsOf(adapter)
        .filter(countable)
        .forEach((word) => assert.deepEqual(reportedAcronyms(without(adapter, word), usage(adapter, word)), [word, "SRE"], word));
    });
  });
});
