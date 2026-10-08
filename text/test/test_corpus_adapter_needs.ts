import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { corpusNeedsOf } from "../scripts/corpus-findings.ts";
import { adapterNeedsOf } from "../packages/chaff/src/check-source.ts";
import { readConfigIn } from "../packages/chaff/src/config/read.ts";
import { rulesOf } from "../packages/chaff/src/custom/load.ts";
import { loadStyles } from "../packages/chaff/src/style-load.ts";
import type { AdapterNeeds } from "../packages/chaff/src/plugin.ts";

const LANGUAGES = ["ja", "en"];
// One genre of each kind whose levels differ on the rules that read parts of speech or token features.
const GENRES = ["technical/readme", "legal/statute", "literature/fiction"];
const STYLES = [undefined, ...loadStyles().map((style) => style.id)];

type Case = { readonly language: string; readonly genre: string; readonly style: string | undefined; readonly experimental: boolean };

const CASES: readonly Case[] = LANGUAGES.flatMap((language) =>
  GENRES.flatMap((genre) => STYLES.flatMap((style) => [true, false].map((experimental) => ({ language, genre, style, experimental })))),
);

/** What `chaff` asks the adapter to prepare in a directory whose chaff.yaml names only the style. */
const cliNeedsOf = (language: string, genre: string, experimental: boolean, style: string | undefined): AdapterNeeds => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-needs-"));
  try {
    if (style !== undefined) writeFileSync(join(dir, "chaff.yaml"), `style: ${style}\n`);
    const config = readConfigIn(dir);
    return adapterNeedsOf(rulesOf(language, config), config, experimental, genre, language);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("the corpus and planted runs prepare the adapter as chaff does", () => {
  it("asks for the same parts of speech and token features for each language, genre, style and --experimental", () => {
    CASES.forEach(({ language, genre, style, experimental }) =>
      assert.deepEqual(
        corpusNeedsOf(language, genre, { experimental, style }),
        cliNeedsOf(language, genre, experimental, style),
        `${language} ${genre} ${String(style)} ${String(experimental)}`,
      ),
    );
  });

  it("asks for LongVowelEnding under a style that keeps the final ー, as chaff does", () => {
    assert.deepEqual(corpusNeedsOf("ja", "technical/readme", { experimental: false, style: "koyobun" }).features, ["LongVowelEnding"]);
  });

  it("does not ask for it where katakana-long-vowel is off", () => {
    assert.deepEqual(corpusNeedsOf("ja", "technical/readme", { experimental: false, settings: { "katakana-long-vowel": "off" } }).features, []);
    assert.deepEqual(corpusNeedsOf("en", "technical/readme", { experimental: true, style: "koyobun" }).features, []);
  });
});
