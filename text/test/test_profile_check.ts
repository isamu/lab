import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unknownProfiles, writtenProfiles } from "../packages/chaff/src/profile/check.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { NO_PROFILE } from "../packages/chaff/src/profile/select.ts";
import { main } from "../packages/chaff/src/cli.ts";

// chaff.yaml に書いた文書の種類（profile）のうち、同梱の profiles/*.yaml に無いもの。
// 無い名前は none と同じに効き、内容から選ぶのも止めてしまう。何も言わずに法令の知識が外れるので、何かする前に止める。

const KNOWN = loadProfiles().map((definition) => definition.id);
const nothing = { config: undefined, byPath: [] };

describe("書かれた文書の種類のうち、知らないもの", () => {
  it("同梱の種類がある", () => assert.ok(KNOWN.includes("statute")));

  it("何も書いていなければ無い", () => assert.deepEqual(unknownProfiles(nothing, KNOWN), []));

  it("知っている種類と none は、どこに書いても通す", () => {
    [...KNOWN, NO_PROFILE].forEach((profile) => {
      const written = { config: profile, byPath: [{ files: ["*.txt"], profile }] };
      assert.deepEqual(unknownProfiles(written, KNOWN), [], profile);
    });
  });

  it("by_path で profile を書かない行は見ない", () => {
    assert.deepEqual(unknownProfiles({ ...nothing, byPath: [{ files: ["*.md"] }, { files: ["*.txt"], profile: undefined }] }, KNOWN), []);
  });

  const unknownCases: readonly (readonly [string, Parameters<typeof unknownProfiles>[0], ReturnType<typeof unknownProfiles>])[] = [
    ["chaff.yaml の profile", { ...nothing, config: "statue" }, [{ where: "config", profile: "statue", files: [] }]],
    [
      "by_path の profile",
      { ...nothing, byPath: [{ files: ["laws/*.txt"], profile: "statue" }] },
      [{ where: "by_path", profile: "statue", files: ["laws/*.txt"] }],
    ],
    // 種類は名前がそのまま一致したときだけ選ばれる。大文字違いや空白付きも、選ばれずに none と同じになる。
    ["大文字違い", { ...nothing, config: "Statute" }, [{ where: "config", profile: "Statute", files: [] }]],
    ["前後の空白", { ...nothing, config: " statute" }, [{ where: "config", profile: " statute", files: [] }]],
    ["None", { ...nothing, config: "None" }, [{ where: "config", profile: "None", files: [] }]],
    ["空", { ...nothing, config: "" }, [{ where: "config", profile: "", files: [] }]],
  ];
  unknownCases.forEach(([label, written, expected]) => {
    it(`知らない種類: ${label}`, () => assert.deepEqual(unknownProfiles(written, KNOWN), expected));
  });

  it("全部を、chaff.yaml、by_path の順に返す", () => {
    const written = {
      config: "a",
      byPath: [
        { files: ["x.txt"], profile: "b" },
        { files: ["y.txt"], profile: "statute" },
        { files: ["z.txt"], profile: NO_PROFILE },
        { files: ["v.txt", "w.txt"], profile: "c" },
      ],
    };
    assert.deepEqual(
      unknownProfiles(written, KNOWN).map((entry) => `${entry.where}:${entry.profile}:${entry.files.join(",")}`),
      ["config:a:", "by_path:b:x.txt", "by_path:c:v.txt,w.txt"],
    );
  });

  it("知っている種類が無ければ、none 以外は全部知らない", () => {
    assert.deepEqual(
      unknownProfiles({ config: "statute", byPath: [{ files: ["*.txt"], profile: NO_PROFILE }] }, []).map((entry) => entry.profile),
      ["statute"],
    );
  });
});

describe("コマンドが読む文書の種類", () => {
  const config = { profile: "statue", byPath: [{ files: ["*.txt"], genre: undefined, language: undefined, profile: "x" }] };

  it("文書を読むコマンドは chaff.yaml の profile と by_path を読む", () => {
    ["lint", "a.md", ".", "test", "eval", "tree", "cite", "baseline", "suppressions", "feedback"].forEach((command) =>
      assert.deepEqual(writtenProfiles(command, config), { config: "statue", byPath: config.byPath }, command),
    );
  });

  it("文書を読まないコマンドは読まない", () => {
    ["init", "genres", "skill", "relax", "strict", "off", "rules", "explain"].forEach((command) =>
      assert.deepEqual(writtenProfiles(command, config), { config: undefined, byPath: [] }, command),
    );
  });
});

type Run = { readonly code: number; readonly out: string; readonly err: string };

// 労働基準法 第一条〜第三条（公共の著作物）。
const STATUTE = [
  "（労働条件の原則）",
  "第一条　労働条件は、労働者が人たるに値する生活を営むための必要を充たすべきものでなければならない。",
  "（労働条件の決定）",
  "第二条　労働条件は、労働者と使用者が、対等の立場において決定すべきものである。",
  "第三条　使用者は、労働者の国籍、信条又は社会的身分を理由として、差別的取扱をしてはならない。",
  "",
].join("\n");

const runIn = async (files: Readonly<Record<string, string>>, args: readonly string[], lang = "ja_JP.UTF-8"): Promise<Run> => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-profile-check-"));
  Object.entries(files).forEach(([name, body]) => writeFileSync(join(dir, name), body));
  const out: string[] = [];
  const err: string[] = [];
  const saved = { log: console.log, error: console.error, cwd: process.cwd(), lang: process.env["LANG"], all: process.env["LC_ALL"] };
  console.log = (...parts: unknown[]) => {
    out.push(parts.join(" "));
  };
  console.error = (...parts: unknown[]) => {
    err.push(parts.join(" "));
  };
  delete process.env["LC_ALL"];
  process.env["LANG"] = lang;
  process.chdir(dir);
  try {
    return { code: await main(args), out: out.join("\n"), err: err.join("\n") };
  } finally {
    process.chdir(saved.cwd);
    console.log = saved.log;
    console.error = saved.error;
    if (saved.lang === undefined) delete process.env["LANG"];
    else process.env["LANG"] = saved.lang;
    if (saved.all !== undefined) process.env["LC_ALL"] = saved.all;
  }
};

const assertStopped = (result: Run, profile: string, where: RegExp): void => {
  assert.equal(result.code, 1);
  assert.equal(result.out, "", "何も検査しない");
  assert.match(result.err, new RegExp(`"${profile}"`, "u"));
  assert.match(result.err, where);
  KNOWN.forEach((known) => assert.ok(result.err.includes(known), `${known} を挙げていない`));
  assert.ok(result.err.includes(NO_PROFILE), "none を挙げていない");
};

describe("知らない文書の種類を CLI はどう扱うか", () => {
  it("chaff.yaml の profile: 何も検査せずに止め、使える種類を挙げる", async () => {
    assertStopped(await runIn({ "chaff.yaml": "profile: statue\n", "a.txt": STATUTE }, ["tree", "a.txt"]), "statue", /chaff\.yaml の profile/u);
  });

  it("chaff.yaml の by_path の profile: 何も検査せずに止め、どの files の行かを言う", async () => {
    const config = 'by_path:\n  - files: "*.txt"\n    profile: statue\n';
    assertStopped(await runIn({ "chaff.yaml": config, "a.txt": STATUTE }, ["a.txt"]), "statue", /by_path.*\*\.txt/u);
  });

  it("英語でも言う", async () => {
    const result = await runIn({ "chaff.yaml": "profile: statue\nlanguage: en\n", "a.txt": STATUTE }, ["a.txt"], "C");
    assertStopped(result, "statue", /There is no document profile "statue" \(profile in chaff\.yaml\)/u);
  });

  it("ジャンルの間違いと一緒なら、両方を言う", async () => {
    const result = await runIn({ "chaff.yaml": "genre: tech\nprofile: statue\n", "a.txt": STATUTE }, ["a.txt"]);
    assert.equal(result.code, 1);
    assert.match(result.err, /"tech"/u);
    assert.match(result.err, /"statue"/u);
  });

  it("文書を読むコマンドはどれも止める", async () => {
    const files = { "chaff.yaml": "profile: statue\n", "a.txt": STATUTE };
    const commands: readonly (readonly string[])[] = [
      ["test", "a.txt", "--dry-run"],
      ["eval", "."],
      ["tree", "a.txt"],
      ["cite", "a.txt", "第一条"],
      ["baseline"],
    ];
    await commands.reduce(async (previous, args) => {
      await previous;
      const result = await runIn(files, args);
      assert.equal(result.code, 1, args.join(" "));
      assert.match(result.err, /"statue"/u, args.join(" "));
    }, Promise.resolve());
  });

  it("文書を読まないコマンドは止めない", async () => {
    const files = { "chaff.yaml": "profile: statue\n" };
    const genres = await runIn(files, ["genres"]);
    assert.equal(genres.code, 0);
    assert.equal(genres.err, "");
    const rules = await runIn(files, ["rules", "--json"]);
    assert.equal(rules.code, 0);
    assert.equal(rules.err, "");
  });

  it("知っている種類なら何も言わず、その種類で読む", async () => {
    const sources: readonly Readonly<Record<string, string>>[] = [
      { "chaff.yaml": "profile: statute\n", "a.txt": STATUTE },
      { "chaff.yaml": 'by_path:\n  - files: "*.txt"\n    profile: statute\n', "a.txt": STATUTE },
      { "a.txt": STATUTE },
    ];
    await sources.reduce(async (previous, files) => {
      await previous;
      const result = await runIn(files, ["tree", "a.txt"]);
      assert.equal(result.code, 0, result.err);
      assert.equal(result.err, "");
      assert.match(result.out, /:profile "statute"/u);
    }, Promise.resolve());
  });

  it("none なら何も言わず、種類を選ばない", async () => {
    const result = await runIn({ "chaff.yaml": "profile: none\n", "a.txt": STATUTE }, ["tree", "a.txt"]);
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, "");
    assert.doesNotMatch(result.out, /:profile/u);
  });
});
