import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_GENRE, genreChoices, genreFromAnswer } from "../packages/chaff/src/init-choice.ts";
import { initGenre, shouldAsk, type Prompter } from "../packages/chaff/src/commands/init-ask.ts";
import { PassThrough } from "node:stream";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import { runInit } from "../packages/chaff/src/init.ts";
import { runCli } from "./cli-run.ts";

const IDS = ["technical/spec", "legal/contract", "literature/poetry"];

describe("init で選んだ答え", () => {
  const cases: readonly (readonly [string, string, string | undefined])[] = [
    ["空なら既定", "", DEFAULT_GENRE],
    ["空白だけでも既定", "   ", DEFAULT_GENRE],
    ["番号", "2", "legal/contract"],
    ["前後の空白を外した番号", " 3 ", "literature/poetry"],
    ["名前", "legal/contract", "legal/contract"],
    ["0 は一覧に無い", "0", undefined],
    ["一覧より大きい番号", "4", undefined],
    ["小数", "1.5", undefined],
    ["負の数", "-1", undefined],
    ["知らない名前", "legal", undefined],
    ["大文字違い", "Legal/Contract", undefined],
  ];
  cases.forEach(([label, answer, expected]) => {
    it(`${label}: ${JSON.stringify(answer)}`, () => assert.equal(genreFromAnswer(answer, IDS), expected));
  });
});

describe("init の一覧", () => {
  const data = loadGenres();
  /** The genres whose line is missing, not numbered by their place in genres.yaml, or not followed by their summary. */
  const misplaced = (lines: readonly string[], ui: "ja" | "en"): string[] =>
    data.genres
      .filter((genre, index) => {
        const line = lines.find((entry) => entry.includes(` ${genre.id} `)) ?? "";
        return !new RegExp(`^\\s*${String(index + 1)}\\s`, "u").test(line) || !line.includes(genre.summary[ui] ?? "missing");
      })
      .map((genre) => genre.id);

  (["ja", "en"] as const).forEach((ui) => {
    it(`${ui}: すべてのジャンルを 1 から番号を振って、その言語の説明と並べる`, () => assert.deepEqual(misplaced(genreChoices(data, ui), ui), []));
  });
});

describe("init が尋ねるとき", () => {
  const cases: readonly (readonly [string, boolean | undefined, boolean | undefined, boolean, boolean])[] = [
    ["端末で、chaff.yaml が無い", true, true, false, true],
    ["chaff.yaml が既にある（何も書かないので尋ねない）", true, true, true, false],
    ["入力が端末でない（パイプ・CI）", undefined, true, false, false],
    ["出力が端末でない", true, false, false, false],
    ["どちらも端末でない", false, false, false, false],
  ];
  cases.forEach(([label, stdin, stdout, exists, expected]) => {
    it(label, () => assert.equal(shouldAsk({ isTTY: stdin }, { isTTY: stdout }, exists), expected));
  });
});

/** A terminal made of streams: the answer typed, and everything init printed. */
const terminal = (answer: string, isTTY = true): { io: Prompter; printed: () => string } => {
  const input = Object.assign(new PassThrough(), { isTTY });
  const output = Object.assign(new PassThrough(), { isTTY });
  const chunks: string[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk.toString("utf8")));
  input.end(`${answer}\n`);
  return { io: { input, output }, printed: () => chunks.join("") };
};

describe("init が端末で尋ねる", () => {
  const ids = loadGenres().genres.map((genre) => genre.id);
  const dir = (): string => mkdtempSync(join(tmpdir(), "chaff-init-"));

  it("一覧を出して、番号で選んだジャンルを返す", async () => {
    const { io, printed } = terminal("2");
    assert.deepEqual(await initGenre(undefined, "ja", dir(), io), { genre: ids[1] });
    assert.match(printed(), /どの種類の文書をここに置きますか/u);
    assert.match(printed(), /番号か名前を入れてください（Enter で blog\/tech）: /u);
  });

  it("名前でも選べ、Enter なら既定", async () => {
    assert.deepEqual(await initGenre(undefined, "en", dir(), terminal("docs/faq").io), { genre: "docs/faq" });
    assert.deepEqual(await initGenre(undefined, "en", dir(), terminal("").io), { genre: DEFAULT_GENRE });
  });

  it("一覧に無い答えは、何も書かずに理由を返す", async () => {
    const result = await initGenre(undefined, "ja", dir(), terminal("小説").io);
    assert.deepEqual(result, { error: "「小説」は一覧にありません。何も作っていません。npx chaffjs init --genre <ジャンル> でも選べます。" });
  });

  it("--genre があれば尋ねない", async () => {
    const { io, printed } = terminal("2");
    assert.deepEqual(await initGenre("legal/patent", "ja", dir(), io), { genre: "legal/patent" });
    assert.equal(printed(), "");
  });

  it("端末でなければ尋ねない", async () => {
    const { io, printed } = terminal("2", false);
    assert.deepEqual(await initGenre(undefined, "ja", dir(), io), { genre: DEFAULT_GENRE });
    assert.equal(printed(), "");
  });

  it("chaff.yaml が既にあれば尋ねない", async () => {
    const run = await runCli({ "chaff.yaml": "genre: blog/essay\n" }, ["genres"]);
    const { io, printed } = terminal("2");
    assert.deepEqual(await initGenre(undefined, "ja", run.dir, io), { genre: DEFAULT_GENRE });
    assert.equal(printed(), "");
  });
});

describe("init が書く chaff.yaml", () => {
  it("ジャンルの説明をコメントに書く", () => {
    const ja = mkdtempSync(join(tmpdir(), "chaff-init-"));
    runInit(ja, "legal/contract", "ja");
    assert.match(
      readFileSync(join(ja, "chaff.yaml"), "utf8"),
      /# この場所に置く文書の種類（契約書・利用規約・プライバシーポリシー）。ほかの種類: npx chaffjs genres\ngenre: legal\/contract\n/u,
    );
    const en = mkdtempSync(join(tmpdir(), "chaff-init-"));
    runInit(en, "literature/poetry", "en");
    assert.match(
      readFileSync(join(en, "chaff.yaml"), "utf8"),
      /# The kind of document kept here \(Poems and verse\)\. The others: npx chaffjs genres\ngenre: literature\/poetry\n/u,
    );
  });

  it("端末でなければ尋ねずに既定を書く", async () => {
    const run = await runCli({}, ["init"]);
    assert.equal(run.code, 0);
    assert.match(readFileSync(join(run.dir, "chaff.yaml"), "utf8"), /^genre: blog\/tech$/mu);
  });

  it("--genre のジャンルを書く", async () => {
    const run = await runCli({}, ["init", "--genre", "speech/transcript"]);
    assert.equal(run.code, 0);
    assert.match(readFileSync(join(run.dir, "chaff.yaml"), "utf8"), /^genre: speech\/transcript$/mu);
  });

  it("知らない --genre なら何も書かずに止める", async () => {
    const run = await runCli({}, ["init", "--genre", "legal/contracts"]);
    assert.equal(run.code, 1);
    assert.equal(existsSync(join(run.dir, "chaff.yaml")), false);
  });
});
