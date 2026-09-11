import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guessLanguage } from "../packages/chaff/src/detect.ts";
import { japaneseRatio, latinRatio } from "../packages/chaff/src/detect-language.ts";

describe("言語の推定", () => {
  it("日本語を日本語と判定する", () => {
    assert.equal(guessLanguage("キャッシュの寿命を短くすると整合性は保てる。").language, "ja");
  });

  it("英語を英語と判定する", () => {
    assert.equal(guessLanguage("Keeping the cache short preserves consistency.").language, "en");
  });

  it("英字を多く含む日本語の技術文書でも日本語と判定する", () => {
    // 技術文書はコマンド名と識別子で英字比率が上がる。ここを落とすと日本語文書が英語扱いになる。
    const source = "まず `npm i chaff` を実行し、`chaff lint README.md` と打つ。TTL は 3600 秒に設定する。";
    assert.equal(guessLanguage(source).language, "ja");
  });

  it("空文字では比率が 0 になり、例外を投げない", () => {
    assert.equal(japaneseRatio(""), 0);
    assert.equal(latinRatio(""), 0);
    assert.equal(guessLanguage("").language, "en");
  });

  it("空白だけでも 0 除算しない", () => {
    assert.equal(japaneseRatio("   \n\t  "), 0);
  });
});
