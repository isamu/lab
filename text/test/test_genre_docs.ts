import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENRES } from "../packages/chaff/src/genre.ts";

// The pages that start from "pick the kind of document" list every genre by hand; a genre added to genres.yaml must reach them.

const PAGES = ["README.md", "packages/chaff/README.md", "site/src/content/guide/ja/getting-started.md", "site/src/content/guide/en/getting-started.md"];

const read = (page: string): string => readFileSync(new URL(`../${page}`, import.meta.url), "utf8");

describe("ジャンルを選ぶところから書いた文書", () => {
  PAGES.forEach((page) => {
    it(`${page} はどのジャンルも挙げる`, () => {
      const text = read(page);
      assert.deepEqual(
        GENRES.filter((genre) => !text.includes(`\`${genre}\``)),
        [],
      );
    });
  });

  it("どの文書も、書いたジャンルは実在する", () => {
    const written = PAGES.flatMap((page) =>
      [...read(page).matchAll(/`((?:technical|blog|business|legal|docs|academic|literature|speech)\/[a-z-]+)`/gu)].map((match) => match[1] ?? ""),
    );
    assert.deepEqual(
      [...new Set(written)].filter((genre) => !GENRES.includes(genre)),
      [],
    );
  });
});
