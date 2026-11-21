import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { genreKeyFor } from "../packages/chaff/src/levels.ts";
import { renderExplain } from "../packages/chaff/src/render/explain.ts";
import type { LevelTable, RuleDefinition } from "../packages/chaff/src/plugin.ts";

const base = (language: string): RuleDefinition => {
  const rule = loadRules(language).find((entry) => entry.id === "ai-tell");
  if (rule === undefined) throw new Error("ai-tell is missing");
  return rule;
};

const withGenres = (language: string, byGenre: Readonly<Record<string, LevelTable>>): RuleDefinition => ({ ...base(language), by_genre: byGenre });

const noteOf = (rule: RuleDefinition, language: string, genre?: string): string | undefined =>
  renderExplain(rule, "normal", language, genre)
    .split("\n")
    .find((line) => line.includes("numbers") || line.includes("数字"))
    ?.trim();

const BLOG = { blog: { strict: 4, normal: 4, relaxed: 10 } };
const BLOG_ESSAY = { "blog/essay": { strict: 4, normal: 4.8, relaxed: 7 } };

describe("genreKeyFor: the by_genre key whose numbers a genre takes", () => {
  it("finds the parent group, the exact genre, or none", () => {
    assert.equal(genreKeyFor(withGenres("en", BLOG), "blog/essay"), "blog");
    assert.equal(genreKeyFor(withGenres("en", { ...BLOG, ...BLOG_ESSAY }), "blog/essay"), "blog/essay");
    assert.equal(genreKeyFor(withGenres("en", BLOG_ESSAY), "blog/tech"), undefined);
    assert.equal(genreKeyFor(withGenres("en", BLOG), undefined), undefined);
    assert.equal(genreKeyFor(withGenres("en", {}), "blog/essay"), undefined);
  });
});

describe("explain: the genre-numbers note names the genre the numbers belong to", () => {
  it("a genre under a group takes the group's numbers, and says so", () => {
    assert.equal(
      noteOf(withGenres("en", BLOG), "en", "blog/essay"),
      "These numbers are for blog, which blog/essay takes. Other genres take the default numbers.",
    );
    assert.equal(
      noteOf(withGenres("ja", BLOG), "ja", "blog/essay"),
      "この数字は blog のもので、blog/essay はこれを使います。ほかのジャンルは既定の数字を使います。",
    );
  });

  it("a genre no group covers takes the default numbers, and names the groups that differ", () => {
    assert.equal(
      noteOf(withGenres("en", BLOG_ESSAY), "en", "blog/tech"),
      "These numbers are the default ones, which blog/tech takes. blog/essay has numbers of its own.",
    );
    assert.equal(
      noteOf(withGenres("ja", BLOG_ESSAY), "ja", "blog/tech"),
      "この数字は既定のもので、blog/tech はこれを使います。blog/essay は別の数字を持っています。",
    );
  });

  it("agrees in number: one other genre has, several have", () => {
    assert.equal(noteOf(withGenres("en", BLOG), "en"), "These numbers are for the default genre. blog has numbers of its own.");
    assert.equal(
      noteOf(withGenres("en", { ...BLOG, business: { normal: 3 } }), "en"),
      "These numbers are for the default genre. blog / business have numbers of their own.",
    );
  });

  it("the exact genre with its own numbers lists only the others", () => {
    assert.equal(noteOf(withGenres("en", { ...BLOG, ...BLOG_ESSAY }), "en", "blog/essay"), "These numbers are for blog/essay. blog has numbers of its own.");
  });

  it("a rule without genre numbers says nothing", () => {
    assert.equal(noteOf(withGenres("en", {}), "en", "blog/essay"), undefined);
    assert.equal(noteOf(withGenres("ja", {}), "ja"), undefined);
  });
});
