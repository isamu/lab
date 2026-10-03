import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { oddSpellings, type DocumentWords } from "../packages/chaff/src/cross-variants.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { crossDocTermVariant } from "../packages/chaff/src/detectors/cross-variant.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// cross-doc-term-variant: one word spelled one way in some files of a run and another way in the rest. Texts self-written.

const words = (path: string, ...forms: string[]): DocumentWords => ({
  path,
  words: forms.map((form, index) => ({ key: form.replace(/ー$/u, ""), form, offset: index * 10 })),
});

const odd = (docs: readonly DocumentWords[]): string[] =>
  oddSpellings(docs).map((entry) => `${entry.path}@${String(entry.word.offset)} ${entry.word.form}→${entry.usual} (${String(entry.files)}, ${entry.example})`);

describe("oddSpellings: which files are out of step", () => {
  it("the file whose way fewer files use, once per word, at its first place", () => {
    assert.deepEqual(odd([words("a.md", "サーバー"), words("b.md", "ブラウザ", "サーバ", "サーバ"), words("c.md", "サーバー")]), [
      "b.md@10 サーバ→サーバー (2, a.md)",
    ]);
  });

  it("on a tie, the way of the first file in the run's order is the usual one", () => {
    assert.deepEqual(odd([words("a.md", "サーバ"), words("b.md", "サーバー")]), ["b.md@0 サーバー→サーバ (1, a.md)"]);
  });

  it("a file writing the word both ways does not vote, and is not reported", () => {
    assert.deepEqual(odd([words("a.md", "サーバ", "サーバー"), words("b.md", "サーバー")]), []);
    assert.deepEqual(odd([words("a.md", "サーバ", "サーバー"), words("b.md", "サーバー"), words("c.md", "サーバ"), words("d.md", "サーバー")]), [
      "c.md@0 サーバ→サーバー (2, b.md)",
    ]);
  });

  it("nothing when every file agrees, when one file has the word, or when there are no words", () => {
    assert.deepEqual(odd([words("a.md", "サーバー"), words("b.md", "サーバー")]), []);
    assert.deepEqual(odd([words("a.md", "サーバ"), words("b.md")]), []);
    assert.deepEqual(odd([]), []);
  });

  it("different words are not compared", () => {
    assert.deepEqual(odd([words("a.md", "サーバー"), words("b.md", "ブラウザ")]), []);
  });
});

const reported = (files: Readonly<Record<string, string>>, adapter: LanguageAdapter): string[] =>
  crossDocTermVariant(
    Object.entries(files).map(([path, source]) => buildDocument(path, source, adapter)),
    { limit: 0 },
  ).map(({ path, finding }) => `${path}: ${String(finding.values["matched"])} → ${String(finding.values["preferred"])}`);

describe("cross-doc-term-variant: the spellings it reads", async () => {
  await ja.prepare?.({ pos: true });

  it("the final ー of a katakana word", () => {
    const files = { "a.md": "サーバーを起動します。\n", "b.md": "サーバに接続します。\n", "c.md": "サーバーの時計を確かめます。\n" };
    assert.deepEqual(reported(files, ja), ["b.md: サーバ → サーバー"]);
  });

  it("not a katakana word in 「」, which names the word rather than uses it", () => {
    const files = { "a.md": "サーバーを起動します。\n", "b.md": "「サーバ」とは書きません。\n" };
    assert.deepEqual(reported(files, ja), []);
  });

  it("not a word of one mora before its ー, nor a name the team listed", () => {
    const short = { "a.md": "カーを止めます。\n", "b.md": "カを止めます。\n" };
    assert.deepEqual(reported(short, ja), []);
    const named = [buildDocument("a.md", "ブラウザーを開きます。\n", ja, { jargon: [], requiredSections: [], names: ["ブラウザー"] })];
    assert.deepEqual(crossDocTermVariant([...named, buildDocument("b.md", "ブラウザを開きます。\n", ja)], { limit: 0 }), []);
  });

  it("a Latin word with and without a hyphen, case aside", () => {
    const files = { "a.md": "Send an email today.\n", "b.md": "E-mail the team.\n", "c.md": "Read every email.\n" };
    assert.deepEqual(reported(files, en), ["b.md: E-mail → email"]);
  });

  it("the same spelling capitalized at the start of a sentence is the same spelling", () => {
    assert.deepEqual(reported({ "a.md": "E-mail the team.\n", "b.md": "Send an e-mail.\n" }, en), []);
    assert.deepEqual(reported({ "a.md": "Colour matters.\n", "b.md": "Pick a colour.\n" }, en), []);
  });

  it("not Latin words no file writes with a hyphen", () => {
    assert.deepEqual(reported({ "a.md": "The setup is short.\n", "b.md": "Set up the tool.\n" }, en), []);
  });

  it("British and American spellings from the language's lists", () => {
    const files = { "a.md": "Pick a colour.\n", "b.md": "Pick a color.\n", "c.md": "The colour is red.\n" };
    assert.deepEqual(reported(files, en), ["b.md: color → colour"]);
  });
});

describe("cross-doc-term-variant: on the command line", () => {
  it("reports the file of the fewer way, naming one of the others", async () => {
    const files = {
      "chaff.yaml": "language: ja\ngenre: docs/manual\n",
      "a.md": "# 手順\n\nサーバーを起動します。\n",
      "b.md": "# 案内\n\nサーバに接続します。\n",
      "c.md": "# 補足\n\nサーバーの時計を確かめます。\n",
    };
    const run = await runCli(files, ["a.md", "b.md", "c.md", "--experimental", "--compact"]);
    rmSync(run.dir, { recursive: true, force: true });
    assert.match(run.out, /b\.md[\s\S]*3:1 +warning 「サーバ」と書いていますが、一緒に見たほかの 2 ファイルでは「サーバー」です（例：a\.md）/u);
  });
});
