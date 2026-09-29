import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// HTTP のメソッド名（GET、POST）は略語ではなく、展開するものが無い。言語パッケージの語彙表 http-method が持つ。例文は自作。
// api.data.gov の手引き（non-GET requests (such as POST and PUT)）と RFC 9457 の PUT request で報告されていた。

const methodsOf = (adapter: LanguageAdapter): string[] => (adapter.lexicons["http-method"] ?? []).map((entry) => entry.pattern);

const without = (adapter: LanguageAdapter, word: string): LanguageAdapter => ({
  ...adapter,
  lexicons: { ...adapter.lexicons, "http-method": (adapter.lexicons["http-method"] ?? []).filter((entry) => entry.pattern !== word) },
});

const usage = (adapter: LanguageAdapter, word: string): string =>
  adapter.id === "ja" ? `# 手引き\n\n${word} で送ります。SREも見ます。\n` : `# Notes\n\nSend a ${word} request. The SRE joins.\n`;

/** 略語として数えられる長さの語だけ（OPTIONS や CONNECT は長すぎて、もともと数えない）。 */
const countable = (word: string): boolean => word.length <= 6;

[en, ja].forEach((adapter) => {
  describe(`http-method（${adapter.id}）`, () => {
    it("語彙表があり、語は大文字だけ", () => {
      const methods = methodsOf(adapter);
      assert.ok(methods.includes("GET"));
      assert.deepEqual(
        methods.filter((word) => !/^[A-Z]+$/u.test(word)),
        [],
      );
    });

    it("どのメソッド名も数えず、SRE は数える", () => {
      methodsOf(adapter).forEach((word) => assert.deepEqual(reportedAcronyms(adapter, usage(adapter, word)), ["SRE"], word));
    });

    it("語彙表から抜いたメソッド名は数える", () => {
      methodsOf(adapter)
        .filter(countable)
        .forEach((word) => assert.deepEqual(reportedAcronyms(without(adapter, word), usage(adapter, word)), [word, "SRE"], word));
    });
  });
});

describe("undefined-acronym と API の手引き", () => {
  it("en: - で繋いだメソッド名も数えず、説明の無い略語は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe GET query parameter may be used for non-GET requests (such as POST and PUT). The SRE joins.\n"), [
      "SRE",
    ]);
  });
});
