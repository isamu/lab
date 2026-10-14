import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPluginName, isPluginPath, pluginNameOfPackage, RULE_ID } from "../packages/chaff/src/extension/plugin-name.ts";
import { parsePlugin, type PluginOrigin } from "../packages/chaff/src/extension/plugin-parse.ts";
import { API_VERSION } from "../packages/chaff/src/api.ts";
import { runCli } from "./cli-run.ts";

// Plugin packages: plugins: in chaff.yaml, each shipping rules, word lists and house styles under its own name.
// Example sentences are self-written.

const ORIGIN: PluginOrigin = { written: "chaff-plugin-foo", file: "/project/node_modules/chaff-plugin-foo/index.mjs", expectedName: "foo" };
const USE_FOR = ["blog", "business"];
const EXPLAINED = { name: "Name", why: "Why", how_to_fix: "Fix", example: { before: "Before", after: "After" } };
const detect = (): never[] => [];

const plugin = (fields: Record<string, unknown>): Record<string, unknown> => ({ apiVersion: API_VERSION, name: "foo", ...fields });

const kindsIn = (problems: readonly { readonly kind: string }[]): string[] => problems.map((problem) => problem.kind);

const kinds = (exported: unknown, origin = ORIGIN): string[] => kindsIn(parsePlugin(exported, origin, USE_FOR).problems);

describe("plugins", () => {
  describe("names", () => {
    const packages: readonly (readonly [string, string | undefined])[] = [
      ["chaff-plugin-foo", "foo"],
      ["chaff-plugin-house-style", "house-style"],
      ["@acme/chaff-plugin-foo", "@acme/foo"],
      ["@acme/chaff-plugin", "@acme"],
      ["chaff-plugin", undefined],
      ["foo", undefined],
      ["eslint-plugin-foo", undefined],
      ["chaff-plugin-Foo", undefined],
      ["@acme/foo", undefined],
    ];
    packages.forEach(([written, name]) => {
      it(`${written} → ${name ?? "not a plugin package"}`, () => {
        assert.equal(pluginNameOfPackage(written), name);
      });
    });

    it("a path is the project's own plugin; a package name is not", () => {
      assert.deepEqual(["./team", "../x", "/abs/p.mjs", "chaff-plugin-foo", "@acme/chaff-plugin"].map(isPluginPath), [true, true, true, false, false]);
    });

    it("plugin names and the ids they prefix", () => {
      assert.deepEqual(["foo", "@acme/foo", "@acme", "Foo", "foo/bar", "@acme/foo/bar", ""].map(isPluginName), [true, true, true, false, false, false, false]);
      assert.deepEqual(
        ["max-sentence-length", "foo/no-tbd", "@acme/foo/no-tbd", "@acme/no-tbd", "foo/bar/baz", "Foo/x", "foo/"].map((id) => RULE_ID.test(id)),
        [true, true, true, true, false, false, false],
      );
    });
  });

  describe("parsePlugin", () => {
    const full = plugin({
      rules: [
        { ...EXPLAINED, id: "no-tbd", level: "error", detect },
        { ...EXPLAINED, id: "weasel", word_list: "weasel-words", detect },
        { ...EXPLAINED, id: "hedge", word_list: "hedging", detect },
        { ...EXPLAINED, id: "no-asap", type: "words", words: ["ASAP"] },
      ],
      lexicons: { "weasel-words": { en: ["arguably", { pattern: "some say", instead_of: "who says" }], ja: ["と言われている"] } },
      styles: [
        { id: "house", name: "House", summary: "Ours", source: { title: "Guide", url: "https://example.com/guide" }, rules: { "foo/no-tbd": "relaxed" } },
      ],
    });

    it("prefixes every rule, list and style with the plugin's name", () => {
      const read = parsePlugin(full, ORIGIN, USE_FOR);
      assert.deepEqual(read.problems, []);
      const parsed = read.plugin;
      assert.ok(parsed !== undefined);
      assert.deepEqual(
        parsed.rules.map((rule) => [rule.id, rule.plugin, rule.how_to_find, rule.word_list, rule.severity]),
        [
          ["foo/no-tbd", "foo", "module", undefined, "error"],
          ["foo/weasel", "foo", "module", "foo/weasel-words", "warning"],
          ["foo/hedge", "foo", "module", "hedging", "warning"],
          ["foo/no-asap", "foo", "custom-words", undefined, "warning"],
        ],
      );
      assert.deepEqual(Object.keys(parsed.detectors), ["foo/no-tbd", "foo/weasel", "foo/hedge"]);
      assert.deepEqual(parsed.lexicons, {
        en: { "foo/weasel-words": [{ pattern: "arguably" }, { pattern: "some say", instead_of: "who says" }] },
        ja: { "foo/weasel-words": [{ pattern: "と言われている" }] },
      });
      assert.deepEqual(
        parsed.styles.map((style) => [style.id, style.name, style.rules]),
        [["foo/house", { ja: "House", en: "House" }, { "foo/no-tbd": "relaxed" }]],
      );
      assert.deepEqual(parsed.rules[0]?.custom, { type: "module", module: ORIGIN.file, file: ORIGIN.file });
    });

    it("a local plugin has no name to match", () => {
      const local: PluginOrigin = { written: "./team.mjs", file: "/project/team.mjs", expectedName: undefined };
      assert.deepEqual(kinds(plugin({ name: "team" }), local), []);
    });

    it("carries a word-list entry's genres and rewrite, by genre or group", () => {
      const read = parsePlugin(
        plugin({ lexicons: { terms: { en: [{ pattern: "herein", rewrite: "here", genres: ["legal", "blog/tech"] }, "arguably"] } } }),
        ORIGIN,
        USE_FOR,
      );
      assert.deepEqual(read.problems, []);
      assert.deepEqual(read.plugin?.lexicons, {
        en: { "foo/terms": [{ pattern: "herein", rewrite: "here", genres: ["legal", "blog/tech"] }, { pattern: "arguably" }] },
      });
    });

    it("names the plugin, the list, the language and the entry whose genres cannot be read", () => {
      const read = parsePlugin(plugin({ lexicons: { terms: { en: ["ok", { pattern: "herein", genres: ["legal", "leagl", 2] }] } } }), ORIGIN, USE_FOR);
      assert.deepEqual(read.problems, [{ kind: "bad-lexicon-genres", plugin: "chaff-plugin-foo", detail: 'terms (en) "herein": ["leagl",2]' }]);
    });

    const problems: readonly (readonly [string, unknown, string])[] = [
      ["a default export that is not an object", detect, "bad-export"],
      ["no API version", { name: "foo" }, "no-api-version"],
      ["another API version", plugin({ apiVersion: 2 }), "api-version"],
      ["a name that is not a plugin's", plugin({ name: "Foo" }), "bad-name"],
      ["a name other than the package's", plugin({ name: "bar" }), "name-mismatch"],
      ["a code rule without detect", plugin({ rules: [{ ...EXPLAINED, id: "x", type: "module", module: "./x.mjs" }] }), "no-detect"],
      ["a rule without why", plugin({ rules: [{ ...EXPLAINED, why: "", id: "x", detect }] }), "rule"],
      ["rules that are not a list", plugin({ rules: { x: 1 } }), "rule"],
      ["a word list with a bad entry", plugin({ lexicons: { weasel: { en: [1] } } }), "bad-lexicon"],
      ["a word list that is not by language", plugin({ lexicons: { weasel: ["x"] } }), "bad-lexicon"],
      ["a word list with a bad name", plugin({ lexicons: { "Bad Name": { en: ["x"] } } }), "bad-lexicon"],
      ["a word-list entry with genres that are not a list", plugin({ lexicons: { terms: { en: [{ pattern: "x", genres: "legal" }] } } }), "bad-lexicon-genres"],
      ["a word-list entry with an empty genres list", plugin({ lexicons: { terms: { en: [{ pattern: "x", genres: [] }] } } }), "bad-lexicon-genres"],
      ["a word-list entry with a genre that is not text", plugin({ lexicons: { terms: { en: [{ pattern: "x", genres: [1] }] } } }), "bad-lexicon-genres"],
      ["a word-list entry with an unknown genre", plugin({ lexicons: { terms: { en: [{ pattern: "x", genres: ["leagl"] }] } } }), "bad-lexicon-genres"],
      ["a word-list entry with a null genres", plugin({ lexicons: { terms: { en: [{ pattern: "x", genres: null }] } } }), "bad-lexicon-genres"],
      ["a style without a source", plugin({ styles: [{ id: "house", name: "H", summary: "S", rules: { x: "off" } }] }), "bad-style"],
      ["a style without an id", plugin({ styles: [{ name: "H" }] }), "bad-style"],
      ["styles that are not a list", plugin({ styles: {} }), "bad-style"],
    ];
    problems.forEach(([what, exported, kind]) => {
      it(`refuses ${what}, leaving the whole plugin out`, () => {
        const read = parsePlugin(exported, ORIGIN, USE_FOR);
        assert.equal(read.plugin, undefined);
        assert.ok(kindsIn(read.problems).includes(kind), `${kind} in ${kindsIn(read.problems).join(", ")}`);
      });
    });
  });

  describe("the command line", () => {
    const PLUGIN = [
      "export default {",
      "  apiVersion: 1,",
      "  name: 'foo',",
      "  lexicons: { weasel: { en: ['arguably', 'some say'] } },",
      "  rules: [",
      "    {",
      "      id: 'no-tbd', level: 'error', name: 'A date left as TBD', why: 'A reader plans around it', how_to_fix: 'Write the date',",
      "      example: { before: 'It is TBD.', after: 'It is on 1 May.' },",
      "      detect: (doc) => doc.sentences.flatMap((s) => { const at = s.text.indexOf('TBD'); return at < 0 ? [] : [{ start: s.span.start + at, end: s.span.start + at + 3 }]; }),",
      "    },",
      "    {",
      "      id: 'weasel', word_list: 'weasel', name: 'A weasel word', why: 'Nobody said it', how_to_fix: 'Say who',",
      "      example: { before: 'Some say it works.', after: 'Sato says it works.' },",
      "      detect: (doc, { lexicon }) => doc.sentences.flatMap((s) => lexicon.flatMap((entry) => { const at = s.text.toLowerCase().indexOf(entry.pattern); return at < 0 ? [] : [{ start: s.span.start + at, end: s.span.start + at + entry.pattern.length }]; })),",
      "    },",
      "  ],",
      "  styles: [{ id: 'calm', name: 'Calm', summary: 'Dates may wait', source: { title: 'Our guide', url: 'https://example.com/guide' }, rules: { 'foo/no-tbd': 'off' } }],",
      "};",
      "",
    ].join("\n");
    const PACKAGE = { "node_modules/chaff-plugin-foo/package.json": '{ "name": "chaff-plugin-foo", "type": "module", "main": "index.mjs" }' };
    const DOC = "# Plan\n\nThe launch is TBD. Some say it is late.\n";
    const project = (config: readonly string[], plugin = PLUGIN): Record<string, string> => ({
      ...PACKAGE,
      "node_modules/chaff-plugin-foo/index.mjs": plugin,
      "chaff.yaml": ["language: en", ...config, ""].join("\n"),
      "a.md": DOC,
    });
    const WITH_FOO = ["plugins: [chaff-plugin-foo]"];

    it("its rules report like any rule, under the plugin's name", async () => {
      const run = await runCli(project(WITH_FOO), ["a.md", "--compact"], "en_US.UTF-8");
      assert.match(run.out, /error +A date left as TBD: "TBD"/u);
      assert.match(run.out, /warning +A weasel word: "Some say"/u);
      assert.equal(run.code, 1);
    });

    it("explain, rules --json, relax, stet and SARIF know them by their prefixed ids", async () => {
      const explained = await runCli(project(WITH_FOO), ["explain", "foo/no-tbd"], "en_US.UTF-8");
      assert.match(explained.out, /\(foo\/no-tbd\)[\s\S]*This rule comes from the plugin foo\./u);
      const json = await runCli(project(WITH_FOO), ["rules", "--json"], "en_US.UTF-8");
      assert.match(json.out, /"id": "foo\/weasel"[\s\S]*"defined_in": "plugin foo"/u);
      const relaxed = await runCli(project(WITH_FOO), ["relax", "foo/no-tbd", "--why", "a draft"], "en_US.UTF-8");
      assert.match(readFileSync(join(relaxed.dir, "chaff.yaml"), "utf8"), /foo\/no-tbd: relaxed/u);
      const stet = await runCli(
        { ...project(WITH_FOO), "a.md": "# Plan\n\n<!-- stet: foo/no-tbd, foo/weasel — a draft -->\nThe launch is TBD. Some say it is late.\n" },
        ["a.md", "--compact"],
        "en_US.UTF-8",
      );
      assert.equal(stet.code, 0);
      const sarif = await runCli(project(WITH_FOO), ["a.md", "--sarif", "out.sarif"], "en_US.UTF-8");
      assert.match(readFileSync(join(sarif.dir, "out.sarif"), "utf8"), /"ruleId": "chaff\/foo\/no-tbd"/u);
    });

    it("a word-list rule does not run where the plugin has no list for the language, and says so", async () => {
      const files = { ...project(WITH_FOO), "chaff.yaml": "language: ja\nplugins: [chaff-plugin-foo]\n", "a.md": "# 計画\n\n公開日は TBD です。\n" };
      const run = await runCli(files, ["a.md"], "ja_JP.UTF-8");
      assert.match(run.out, /foo\/weasel（プラグイン foo に ja の語彙表 weasel が無いため）/u);
      assert.match(run.out, /A date left as TBD/u);
    });

    it("a style it ships is chosen by its prefixed id", async () => {
      const run = await runCli(project([...WITH_FOO, "style: foo/calm"]), ["a.md", "--compact"], "en_US.UTF-8");
      assert.doesNotMatch(run.out, /A date left as TBD/u);
      const json = await runCli(project([...WITH_FOO, "style: foo/calm"]), ["rules", "--json"], "en_US.UTF-8");
      assert.match(json.out, /"style": \{\s*"id": "foo\/calm"/u);
    });

    it("a plugin of the project's own is named by its path", async () => {
      const local = PLUGIN.replace("name: 'foo'", "name: 'team'");
      const run = await runCli(
        { "chaff.yaml": "language: en\nplugins: [./chaff-plugins/team.mjs]\n", "chaff-plugins/team.mjs": local, "a.md": DOC },
        ["a.md", "--compact"],
        "en_US.UTF-8",
      );
      assert.match(run.out, /error +A date left as TBD/u);
      const json = await runCli(
        { "chaff.yaml": "language: en\nplugins: [./chaff-plugins/team.mjs]\n", "chaff-plugins/team.mjs": local },
        ["rules", "--json"],
        "en_US.UTF-8",
      );
      assert.match(json.out, /"id": "team\/no-tbd"/u);
    });

    it("a rule that throws is listed as not run, naming the plugin; the other rules still run", async () => {
      const throwing = PLUGIN.replace("detect: (doc) => doc.sentences", "detect: (doc) => doc.nothing.sentences");
      const run = await runCli(project(WITH_FOO, throwing), ["a.md"], "en_US.UTF-8");
      assert.match(run.out, /foo\/no-tbd \(the detector in chaff-plugin-foo threw an error/u);
      assert.match(run.out, /A weasel word/u);
    });

    const broken: readonly (readonly [string, Record<string, string>, RegExp])[] = [
      [
        "a package not installed",
        { "chaff.yaml": "plugins: [chaff-plugin-bar]\n", "a.md": DOC },
        /plugins chaff-plugin-bar: not found\. For a package, run yarn add chaff-plugin-bar/u,
      ],
      ["a name that is not a plugin package's", { "chaff.yaml": "plugins: [foo]\n", "a.md": DOC }, /plugins foo: name a package chaff-plugin-<name>/u],
      [
        "a path outside the project",
        { "chaff.yaml": "plugins: [../team.mjs]\n", "a.md": DOC },
        /plugins \.\.\/team\.mjs: it is outside the folder chaff\.yaml is in/u,
      ],
      ["plugins that are not a list", { "chaff.yaml": "plugins: chaff-plugin-foo\n", "a.md": DOC }, /write plugins as a list/u],
      [
        "plugins that are not names",
        { "chaff.yaml": "plugins: [1]\n", "a.md": DOC },
        /write plugins as a list \(- chaff-plugin-foo or - \.\/local-plugin\), not \[1\]/u,
      ],
      [
        "a plugin for another API",
        project(WITH_FOO, PLUGIN.replace("apiVersion: 1", "apiVersion: 2")),
        /plugins chaff-plugin-foo: it was written for plugin API 2; this chaff has plugin API 1/u,
      ],
      [
        "a plugin named other than its package",
        project(WITH_FOO, PLUGIN.replace("name: 'foo'", "name: 'bar'")),
        /plugins chaff-plugin-foo: its name must be foo/u,
      ],
      ["a syntax error", project(WITH_FOO, "export default {\n"), /plugins chaff-plugin-foo: cannot load it \(/u],
      ["a rule missing its why", project(WITH_FOO, PLUGIN.replace("why: 'Nobody said it', ", "")), /plugins chaff-plugin-foo rules weasel: why is missing/u],
      ["the same plugin twice", project(["plugins: [chaff-plugin-foo, ./node_modules/chaff-plugin-foo/index.mjs]"]), /another plugin is named foo/u],
    ];
    broken.forEach(([what, files, message]) => {
      it(`${what} stops the run and says which plugin`, async () => {
        const run = await runCli(files, ["a.md"], "en_US.UTF-8");
        assert.equal(run.code, 1);
        assert.match(run.err, message);
      });
    });

    describe("a word-list entry for some genres only", () => {
      const GENRED = [
        "export default {",
        "  apiVersion: 1,",
        "  name: 'foo',",
        "  lexicons: { terms: { en: [{ pattern: 'herein', rewrite: 'here', genres: ['legal'] }, { pattern: 'arguably', rewrite: 'I think' }] } },",
        "  rules: [",
        "    { id: 'listed', type: 'words', word_list: 'terms', name: 'A listed word', why: 'W', how_to_fix: 'F', example: { before: 'B', after: 'A' } },",
        "    {",
        "      id: 'coded', word_list: 'terms', name: 'A coded word', why: 'W', how_to_fix: 'F', example: { before: 'B', after: 'A' },",
        "      detect: (doc, { lexicon }) => doc.sentences.flatMap((s) => lexicon.flatMap((e) => { const at = s.text.indexOf(e.pattern); return at < 0 ? [] : [{ start: s.span.start + at, end: s.span.start + at + e.pattern.length }]; })),",
        "    },",
        "    {",
        "      id: 'viewed', name: 'A viewed word', why: 'W', how_to_fix: 'F', example: { before: 'B', after: 'A' },",
        "      detect: (doc) => doc.sentences.flatMap((s) => doc.lexicons['foo/terms'].flatMap((e) => { const at = s.text.indexOf(e.pattern); return at < 0 ? [] : [{ start: s.span.start + at, end: s.span.start + at + e.pattern.length }]; })),",
        "    },",
        "  ],",
        "};",
      ].join("\n");
      const inGenre = (genre: string): Record<string, string> => ({
        ...project([`genre: ${genre}`, ...WITH_FOO], GENRED),
        "a.md": "# Terms\n\nThe parties agree herein to pay. It is arguably late.\n",
      });

      it("holds in its genre, for a words rule and a code rule", async () => {
        const run = await runCli(inGenre("legal/contract"), ["a.md", "--compact"], "en_US.UTF-8");
        assert.match(run.out, /A coded word: "herein"/u);
        assert.match(run.out, /Write "here", not "herein"\s+foo\/listed/u);
        assert.match(run.out, /A coded word: "arguably"/u);
        assert.match(run.out, /A viewed word: "herein"/u);
      });

      it("is left out in another genre, while the entries for every genre still hold", async () => {
        const run = await runCli(inGenre("blog/tech"), ["a.md", "--compact"], "en_US.UTF-8");
        assert.doesNotMatch(run.out, /herein/u);
        assert.match(run.out, /A coded word: "arguably"/u);
        assert.match(run.out, /Write "I think", not "arguably"\s+foo\/listed/u);
        assert.match(run.out, /A viewed word: "arguably"/u);
      });

      it("an unknown genre stops the run, naming the plugin, the list and the entry", async () => {
        const run = await runCli(project(WITH_FOO, GENRED.replace("genres: ['legal']", "genres: ['leagl']")), ["a.md"], "en_US.UTF-8");
        assert.equal(run.code, 1);
        assert.match(run.err, /plugins chaff-plugin-foo: cannot read the genres of the word list entry terms \(en\) "herein": \["leagl"\]/u);
      });
    });

    it("a problem reads in Japanese too", async () => {
      const run = await runCli({ "chaff.yaml": "plugins: [chaff-plugin-bar]\n", "a.md": DOC }, ["a.md"], "ja_JP.UTF-8");
      assert.match(run.err, /plugins の chaff-plugin-bar: 見つかりません/u);
    });
  });
});
