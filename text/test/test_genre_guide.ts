import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import { parseGenres } from "../packages/chaff/src/genre-parse.ts";
import { guideLayerOf, type GuideLayer } from "../packages/chaff/src/genre-guide/layer.ts";
import { bundledGuideOf } from "../packages/chaff/src/genre-guide/lines.ts";
import { BUNDLED_GUIDES, resolveGuide } from "../packages/chaff/src/genre-guide/resolve.ts";
import { configGuideProblems, genreGuideFor } from "../packages/chaff/src/genre-guide/of-config.ts";
import { guideProblemText } from "../packages/chaff/src/genre-guide/problem-text.ts";
import { readConfigIn } from "../packages/chaff/src/config/read.ts";
import { extensionProblems } from "../packages/chaff/src/extension/problem-text.ts";
import { withExtensions } from "../packages/chaff/src/extension/load.ts";
import { styleOf } from "../packages/chaff/src/style-parse.ts";
import { knownGenres } from "../packages/chaff/src/known-genres.ts";

const GENRES = loadGenres();

const localized = (text: string): { ja: string; en: string } => ({ ja: `${text}（ja）`, en: text });

const TOY = parseGenres({
  groups: [
    { id: "legal", name: localized("Legal"), guide: { ja: ["定義語をそのまま使う"], en: ["Use defined terms exactly"] } },
    { id: "blog", name: localized("Blog") },
  ],
  genres: [
    { id: "legal/contract", name: localized("Contract"), summary: localized("Contracts"), guide: { ja: ["当事者"], en: ["Parties", "Deadlines"] } },
    { id: "legal/statute", name: localized("Statute"), summary: localized("Statutes") },
    { id: "blog/tech", name: localized("Tech"), summary: localized("Articles") },
  ],
});

const KNOWN = ["legal", "blog", "legal/contract", "legal/statute", "blog/tech"];

const layer = (from: string, raw: unknown): GuideLayer => {
  const read = guideLayerOf(raw, from, KNOWN);
  assert.deepEqual(read.problems, []);
  return read.layer;
};

/** A folder holding files, as a team's repository would. */
const folder = (files: Readonly<Record<string, string>>): string => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-guide-"));
  Object.entries(files).forEach(([name, body]) => {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), body);
  });
  return dir;
};

describe("genres.yaml — every genre has a guide", () => {
  // A guide of one or two lines says too little to rewrite against; the loader already refuses an empty line.
  const MIN_LINES = 3;

  it("in ja and in en, of its own, with as many lines in each", () => {
    GENRES.genres.forEach((genre) => {
      const [ja, en] = [genre.guide?.["ja"] ?? [], genre.guide?.["en"] ?? []];
      assert.ok(ja.length >= MIN_LINES && en.length >= MIN_LINES, `${genre.id} has a guide of ${String(MIN_LINES)} lines or more in ja and en`);
      assert.equal(ja.length, en.length, `${genre.id}: as many lines in ja as in en`);
    });
  });

  it("every group has one too, for a genre added later without its own", () => {
    GENRES.groups.forEach((group) => {
      assert.ok((group.guide?.["ja"] ?? []).length > 0, `${group.id} ja`);
      assert.ok((group.guide?.["en"] ?? []).length > 0, `${group.id} en`);
    });
  });

  it("names the same checks a contract, a statute, a manual and a tech blog are read for", () => {
    const en = (genre: string): string => (resolveGuide(GENRES, genre, "en", [])?.lines ?? []).join("\n");
    assert.match(en("blog/tech"), /one claim/u);
    assert.match(en("blog/tech"), /versions/u);
    assert.match(en("legal/contract"), /defined term/u);
    assert.match(en("legal/statute"), /cross-reference/u);
    assert.match(en("docs/manual"), /one task/u);
  });
});

describe("a bundled guide is read strictly", () => {
  it("needs a list in ja and in en", () => {
    assert.throws(() => bundledGuideOf({ ja: ["一行"] }, "blog/tech"), /blog\/tech: guide needs a list of lines in ja and in en/u);
    assert.throws(() => bundledGuideOf(["one line"], "blog/tech"), /guide needs/u);
    assert.throws(() => bundledGuideOf({ ja: ["一行"], en: [""] }, "blog/tech"), /guide needs/u);
    assert.throws(() => bundledGuideOf({ ja: ["一行"], en: [3] }, "blog/tech"), /guide needs/u);
    assert.equal(bundledGuideOf(undefined, "blog/tech"), undefined);
  });

  it("a genre without one reads its group's; a group without one leaves the genre with none", () => {
    assert.deepEqual(resolveGuide(TOY, "legal/statute", "en", [])?.lines, ["Use defined terms exactly"]);
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [])?.lines, ["Parties", "Deadlines"]);
    assert.equal(resolveGuide(TOY, "blog/tech", "en", []), undefined);
  });

  it("an unknown genre has no guide", () => {
    assert.equal(resolveGuide(TOY, "legal", "en", []), undefined);
    assert.equal(resolveGuide(TOY, "cookbook/recipe", "ja", []), undefined);
    assert.equal(resolveGuide(GENRES, "no/such", "en", []), undefined);
  });
});

describe("guide: as a team writes it", () => {
  it("replace sets the lines, add puts lines after them, off leaves none", () => {
    const replaced = resolveGuide(TOY, "legal/contract", "en", [layer("chaff.yaml", { "legal/contract": { replace: { en: ["Ours"] } } })]);
    assert.deepEqual(replaced, { genre: "legal/contract", lines: ["Ours"], from: [BUNDLED_GUIDES, "chaff.yaml"] });
    const added = resolveGuide(TOY, "legal/contract", "en", [layer("chaff.yaml", { "legal/contract": { add: { en: "And ours" } } })]);
    assert.deepEqual(added?.lines, ["Parties", "Deadlines", "And ours"]);
    assert.equal(resolveGuide(TOY, "legal/contract", "en", [layer("chaff.yaml", { "legal/contract": "off" })]), undefined);
    assert.equal(resolveGuide(TOY, "legal/contract", "en", [layer("chaff.yaml", { "legal/contract": false })]), undefined);
  });

  it("replace then add in one entry; a text without ja: or en: is the same in every language", () => {
    const both = layer("chaff.yaml", { "legal/contract": { replace: ["A", "B"], add: "C" } });
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "ja", [both])?.lines, ["A", "B", "C"]);
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [both])?.lines, ["A", "B", "C"]);
  });

  it("a replace in one language leaves the other language's lines", () => {
    const jaOnly = layer("chaff.yaml", { "legal/contract": { replace: { ja: "私たちの" } } });
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "ja", [jaOnly])?.lines, ["私たちの"]);
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [jaOnly]), { genre: "legal/contract", lines: ["Parties", "Deadlines"], from: [BUNDLED_GUIDES] });
  });

  it("a group's entry applies to every genre in it, before the genre's own", () => {
    const edits = layer("chaff.yaml", { legal: { add: "Group line" }, "legal/contract": { add: "Genre line" } });
    assert.deepEqual(resolveGuide(TOY, "legal/statute", "en", [edits])?.lines, ["Use defined terms exactly", "Group line"]);
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [edits])?.lines, ["Parties", "Deadlines", "Group line", "Genre line"]);
  });

  it("gives a genre with no bundled guide one of its own, and turns a group's off for one genre", () => {
    assert.deepEqual(resolveGuide(TOY, "blog/tech", "en", [layer("chaff.yaml", { blog: { add: "Show the code" } })])?.lines, ["Show the code"]);
    assert.equal(resolveGuide(TOY, "legal/statute", "en", [layer("chaff.yaml", { "legal/statute": "off" })]), undefined);
    assert.ok(resolveGuide(TOY, "legal/contract", "en", [layer("chaff.yaml", { "legal/statute": "off" })]) !== undefined);
  });

  it("the stronger layer wins: chaff.yaml over a style, a style over a rule pack, a rule pack over genres.yaml", () => {
    const pack = layer("plugins: house", { "legal/contract": { replace: "From the pack" } });
    const style = layer("style: house/strict", { "legal/contract": { replace: "From the style" } });
    const config = layer("chaff.yaml", { "legal/contract": { replace: "From chaff.yaml" } });
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [pack])?.lines, ["From the pack"]);
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [pack, style])?.lines, ["From the style"]);
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", [pack, style, config]), {
      genre: "legal/contract",
      lines: ["From chaff.yaml"],
      from: [BUNDLED_GUIDES, "plugins: house", "style: house/strict", "chaff.yaml"],
    });
    const offThenAdd = [layer("plugins: house", { "legal/contract": "off" }), layer("chaff.yaml", { "legal/contract": { add: "Only this" } })];
    assert.deepEqual(resolveGuide(TOY, "legal/contract", "en", offThenAdd)?.lines, ["Only this"]);
    const quiet = layer("style: house/quiet", "off");
    assert.equal(resolveGuide(TOY, "legal/contract", "en", [quiet]), undefined);
    assert.deepEqual(resolveGuide(TOY, "legal/statute", "en", [quiet, layer("chaff.yaml", { legal: { add: "Only this" } })])?.lines, ["Only this"]);
  });

  it("reports what it cannot read and keeps the rest", () => {
    const read = guideLayerOf(
      {
        "legal/contract": { add: "Kept" },
        "cookbook/recipe": { add: "x" },
        "legal/statute": { prepend: "x" },
        blog: { replace: { en: [1] } },
        "blog/tech": "on",
        legal: {},
      },
      "chaff.yaml",
      KNOWN,
    );
    assert.deepEqual(Object.keys(read.layer.edits), ["legal/contract"]);
    assert.deepEqual(read.problems, [
      { kind: "unknown-genre", genre: "cookbook/recipe" },
      { kind: "bad-entry", genre: "legal/statute", written: '{"prepend":"x"}' },
      { kind: "bad-lines", genre: "blog", field: "replace" },
      { kind: "bad-entry", genre: "blog/tech", written: '"on"' },
      { kind: "bad-entry", genre: "legal", written: "{}" },
    ]);
    assert.deepEqual(guideLayerOf(["a"], "chaff.yaml", KNOWN).problems, [{ kind: "not-a-map", written: '["a"]' }]);
    assert.deepEqual(guideLayerOf("off", "chaff.yaml", KNOWN), { layer: { from: "chaff.yaml", allOff: true, edits: {} }, problems: [] });
    assert.deepEqual(guideLayerOf({ blog: { add: { fr: "Une ligne" } } }, "chaff.yaml", KNOWN).problems, [{ kind: "bad-lines", genre: "blog", field: "add" }]);
    assert.deepEqual(guideLayerOf(null, "chaff.yaml", KNOWN).problems, []);
  });

  it("says each problem in Japanese and in English", () => {
    const problems = guideLayerOf({ "cookbook/recipe": "off", blog: 3, legal: { add: [] } }, "chaff.yaml", KNOWN).problems;
    assert.equal(problems.length, 3);
    problems.forEach((problem) => {
      assert.match(guideProblemText(problem, "ja"), /^guide の /u);
      assert.match(guideProblemText(problem, "en"), /^guide /u);
    });
    assert.match(guideProblemText({ kind: "not-a-map", written: "3" }, "en"), /guide: off/u);
  });
});

const CONTRACT_EN = "Are the parties named the same way (as defined) from start to end?";

describe("guide: through chaff.yaml, a style and a rule pack, as a team loads them", () => {
  it("chaff.yaml's guide: off turns every guide off; nothing written leaves the bundled one", () => {
    assert.equal(genreGuideFor(readConfigIn(folder({ "chaff.yaml": "guide: off\n" })), "legal/contract", "en"), undefined);
    assert.equal(genreGuideFor(readConfigIn(folder({ "chaff.yaml": "guide: false\n" })), "legal/contract", "en"), undefined);
    assert.equal(genreGuideFor(readConfigIn(folder({ "chaff.yaml": "genre: legal/contract\n" })), "legal/contract", "en")?.lines[0], CONTRACT_EN);
    assert.equal(genreGuideFor(readConfigIn(folder({})), "legal/contract", "en")?.lines[0], CONTRACT_EN);
  });

  it("chaff.yaml adds to a bundled guide, and warns about an entry it cannot read", () => {
    const yaml = [
      "guide:",
      "  legal/contract:",
      "    add:",
      "      ja: 支払期日は月末締め翌月末払いで書く",
      "      en: Payment terms say net 30",
      "  legal/memo: off",
      "",
    ];
    const config = readConfigIn(folder({ "chaff.yaml": yaml.join("\n") }));
    const ja = genreGuideFor(config, "legal/contract", "ja");
    assert.equal(ja?.lines.at(-1), "支払期日は月末締め翌月末払いで書く");
    assert.deepEqual(ja?.from, [BUNDLED_GUIDES, "chaff.yaml"]);
    assert.equal(genreGuideFor(config, "legal/contract", "en")?.lines.at(-1), "Payment terms say net 30");
    assert.deepEqual(
      configGuideProblems(config, "en").map((line) => line.replace(/^.*chaff\.yaml: /u, "")),
      ["guide names legal/memo, which is no genre or group (npx chaffjs genres lists them)"],
    );
  });

  const PACK = {
    "house/chaff-plugin.yaml": [
      "apiVersion: 1",
      "name: house",
      "guide:",
      "  legal/contract:",
      "    replace:",
      "      ja: [社の契約書の型に沿っているか]",
      "      en: [Does it follow the house contract template?]",
      "",
    ].join("\n"),
    "house/styles/strict.yaml": [
      "id: strict",
      "name: Strict",
      "summary: Stricter contracts",
      "source: { title: House, url: https://example.com/house }",
      "guide:",
      "  legal/contract:",
      "    add: Every amount is in yen, tax included",
      "",
    ].join("\n"),
  };

  it("a rule pack's guide replaces the bundled one", async () => {
    const config = await withExtensions(readConfigIn(folder({ ...PACK, "chaff.yaml": "plugins:\n  - ./house\n" })));
    assert.deepEqual(config.extensions?.pluginProblems, []);
    assert.deepEqual(genreGuideFor(config, "legal/contract", "en"), {
      genre: "legal/contract",
      lines: ["Does it follow the house contract template?"],
      from: [BUNDLED_GUIDES, "plugins: house"],
    });
    assert.equal(genreGuideFor(config, "blog/tech", "en")?.from.length, 1);
  });

  it("the pack's style adds to the pack's, and chaff.yaml overrides both", async () => {
    const styled = await withExtensions(readConfigIn(folder({ ...PACK, "chaff.yaml": "style: house/strict\nplugins:\n  - ./house\n" })));
    assert.deepEqual(genreGuideFor(styled, "legal/contract", "en")?.lines, [
      "Does it follow the house contract template?",
      "Every amount is in yen, tax included",
    ]);
    const yaml = "style: house/strict\nplugins:\n  - ./house\nguide:\n  legal/contract:\n    replace: Ours alone\n";
    const config = await withExtensions(readConfigIn(folder({ ...PACK, "chaff.yaml": yaml })));
    assert.deepEqual(genreGuideFor(config, "legal/contract", "ja"), {
      genre: "legal/contract",
      lines: ["Ours alone"],
      from: [BUNDLED_GUIDES, "plugins: house", "style: house/strict", "chaff.yaml"],
    });
  });

  it("a pack's guide: off turns every bundled guide off", async () => {
    const quiet = { "quiet/chaff-plugin.yaml": "apiVersion: 1\nname: quiet\nguide: off\n", "chaff.yaml": "plugins:\n  - ./quiet\n" };
    const config = await withExtensions(readConfigIn(folder(quiet)));
    assert.equal(genreGuideFor(config, "legal/contract", "en"), undefined);
    assert.equal(genreGuideFor(config, "blog/tech", "ja"), undefined);
  });

  it("a pack whose guide cannot be read stops the run, naming the pack", async () => {
    const broken = { "house/chaff-plugin.yaml": "apiVersion: 1\nname: house\nguide:\n  legal/memo: off\n", "chaff.yaml": "plugins:\n  - ./house\n" };
    const config = await withExtensions(readConfigIn(folder(broken)));
    assert.deepEqual(
      extensionProblems(config, "en").map((line) => line.replace(/^.*chaff\.yaml: /u, "")),
      ["plugins ./house: guide names legal/memo, which is no genre or group (npx chaffjs genres lists them)"],
    );
    assert.match(extensionProblems(config, "ja")[0] ?? "", /plugins の \.\/house: guide の legal\/memo というジャンルや群はありません/u);
  });

  it("a style may set only a guide, and one it cannot read is the style's error", () => {
    const base = { id: "plain", name: localized("Plain"), summary: localized("Plain"), source: { title: localized("Plain"), url: "https://example.com" } };
    assert.deepEqual(styleOf({ ...base, guide: { blog: { add: "x" } } }, "plain").guide?.edits, { blog: { kind: "edit", add: { ja: ["x"], en: ["x"] } } });
    assert.throws(() => styleOf({ ...base, guide: { cookbook: "off" } }, "plain"), /plain: guide names cookbook, which is no genre or group/u);
    assert.throws(() => styleOf(base, "plain"), /must set rules, options or guide/u);
  });

  it("a guide entry may name any genre or group chaff knows", () => {
    const every = Object.fromEntries(knownGenres().map((genre) => [genre, "off"]));
    assert.deepEqual(guideLayerOf(every, "chaff.yaml", knownGenres()).problems, []);
  });
});
