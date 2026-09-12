import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { frontMatterGenre, guessGenre } from "../packages/chaff/src/genre.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { GENRES } from "../packages/chaff/src/init.ts";

const guess = (path: string, source = "本文です。"): string | undefined => guessGenre(path, source, undefined)?.genre;

describe("ジャンルの判定", () => {
  it("README は技術文書", () => {
    assert.equal(guess("README.md"), "technical/readme");
    assert.equal(guess("packages/chaff/README.md"), "technical/readme");
  });

  it("仕様書は技術文書", () => {
    assert.equal(guess("chaff-spec.md"), "technical/spec");
    assert.equal(guess("spec/overview.md"), "technical/spec");
  });

  it("docs/ は技術文書", () => {
    assert.equal(guess("docs/ChangeLog.md"), "technical/readme");
  });

  it("記事のディレクトリはブログ", () => {
    assert.equal(guess("blog/a.md"), "blog/tech");
    assert.equal(guess("posts/a.md"), "blog/tech");
  });

  it("手がかりが無ければ決めない", () => {
    // 推測で走らせない。呼ぶ側が既定を当てる。
    assert.equal(guess("a.md"), undefined);
  });

  it("本文の言及だけでは議事録にしない", () => {
    // 「決定事項」を説明している文書を議事録と判定していた。見出しと行頭に限る。
    assert.equal(guess("a.md", "ここでは決定事項の書き方を説明します。"), undefined);
    assert.equal(guess("a.md", "## 決定事項\n\nA を採用する。"), "business/meeting-notes");
  });

  it("front matter が最優先", () => {
    assert.equal(guessGenre("README.md", "x", "blog/essay")?.genre, "blog/essay");
    assert.equal(frontMatterGenre("---\ngenre: blog/essay\n---\n本文"), "blog/essay");
  });
});

describe("技術文書で動く rule", () => {
  const forGenre = (genre: string): string[] =>
    loadRules("ja")
      .filter((rule) => rule.use_for.some((target) => genre.startsWith(target)))
      .map((rule) => rule.id);

  it("ブログ向けの rule は動かさない", () => {
    // 仕様書に「つかみ」も「締め」も「読むリズム」も要らない。
    const technical = forGenre("technical/spec");
    ["padded-intro", "closing-cliche", "sentence-rhythm", "empty-conclusion"].forEach((id) =>
      assert.ok(!technical.includes(id), `${id} が技術文書で動いている`),
    );
  });

  it("構造と語彙の rule は動かす", () => {
    const technical = forGenre("technical/spec");
    ["max-sentence-length", "heading-echo", "bold-density", "empty-intensifier", "repeated-sentence-head"].forEach((id) =>
      assert.ok(technical.includes(id), `${id} が技術文書で動いていない`),
    );
  });

  it("ビジネス向けの L4 は動かさない", () => {
    const technical = forGenre("technical/readme");
    ["risk-disclosure", "unsourced-number"].forEach((id) => assert.ok(!technical.includes(id), `${id} が技術文書で動いている`));
  });

  it("一覧に載っている", () => {
    assert.ok(GENRES.includes("technical/spec"));
    assert.ok(GENRES.includes("technical/readme"));
  });
});
