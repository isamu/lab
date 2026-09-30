import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { runOnUrls } from "../packages/chaff/src/detectors/url-run-on.ts";

// URL のすぐ後ろに続く字（url-run-on）。例文はすべて自作。

const RULE = "url-run-on";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

describe("url-run-on: URL のすぐ後ろに続く字", () => {
  it("URL の直後の日本語を指摘する", () => {
    assert.deepEqual(findingsOf("詳しくは https://example.jp/docsをご覧ください。\n"), [
      "URL「https://example.jp/docs」の直後に「を」が続いています。リンクがそこまで伸びます",
    ]);
  });

  it("全角の括弧や句点も同じ", () => {
    assert.deepEqual(findingsOf("資料（https://example.jp/a）と https://example.jp/b。\n").length, 2);
  });

  it("英語の文書の、URL の直後のダッシュ", () => {
    assert.deepEqual(findingsOf("See https://example.com/docs—the full guide.\n", en), [
      'The URL "https://example.com/docs" is followed by "—" with no space; the link runs on into it',
    ]);
  });

  it("空白や ASCII の句読点が続くなら指摘しない", () => {
    assert.deepEqual(
      findingsOf(
        "詳しくは https://example.jp/docs をご覧ください。See https://example.com/docs. Or https://example.com/a, then https://example.jp/b　全角の空白。\n",
      ),
      [],
    );
  });

  it("リンクの記法で書いた URL とコードの中は数えない", () => {
    assert.deepEqual(findingsOf("<https://example.jp/a>を見る。[資料](https://example.jp/b)を見る。`https://example.jp/c`を見る。\n"), []);
  });

  it("見えない字（ゼロ幅の空白）は続いて見えない", () => {
    assert.deepEqual(findingsOf("See https://example.com/​Downloads.\n", en), []);
  });

  it("テキストの文書でも動く", () => {
    assert.deepEqual(findingsOf("詳しくは https://example.jp/docsをご覧ください。\n", ja, "a.txt").length, 1);
  });

  it("位置と続く字", () => {
    assert.deepEqual(runOnUrls("x https://a.jp/b。", [{ start: 0, end: 17 }]), [{ url: { start: 2, end: 16 }, next: "。" }]);
    assert.deepEqual(runOnUrls("", [{ start: 0, end: 0 }]), []);
  });
});
