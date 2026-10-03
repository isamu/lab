import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { argsOf, countsLine, fillsFor, hasFill, missingFills, notRunBlock, notRunRow, screenMatches, screensIn } from "../scripts/guide-screens-parse.ts";
import { UNCHECKED } from "../scripts/guide-screens.ts";
import { COUNTS_MARKER, NOT_RUN_MARKER, fillPage, notRunRowMarker, withScreenFills } from "../site/src/lib/screenFills.ts";

// 手引きの画面にある「動いていない rule」の一覧と、--compact の最後の集計の行は、ページに書き写さず、サイトを作るときに
// chaff の出力から入れる。rule を足す PR が、手引きのページを書き換えなくて済むため。

const FENCE = "```";
const GUIDE = join(import.meta.dirname, "..", "site", "src", "content", "guide");

const page = [
  `${FENCE}markdown file=report.md`,
  "# Report",
  "",
  "Body.",
  FENCE,
  "",
  FENCE,
  "$ npx chaffjs report.md --genre business/report",
  "",
  "  No findings",
  "",
  `  ${NOT_RUN_MARKER}`,
  FENCE,
  "",
  "<!-- chaff-screen: stet -->",
  FENCE,
  "$ npx chaffjs report.md --compact",
  "",
  COUNTS_MARKER,
  FENCE,
  "",
].join("\n");

describe("screensIn", () => {
  it("file= の付いた塊を文書として、chaffjs で始まる塊を画面として、ページの順に読む", () => {
    assert.deepEqual(screensIn(page), {
      documents: { "report.md": "# Report\n\nBody.\n" },
      screens: [
        {
          command: "$ npx chaffjs report.md --genre business/report",
          args: ["report.md", "--genre", "business/report"],
          shown: `$ npx chaffjs report.md --genre business/report\n\n  No findings\n\n  ${NOT_RUN_MARKER}\n`,
        },
        {
          command: "$ npx chaffjs report.md --compact",
          args: ["report.md", "--compact"],
          setup: "stet",
          shown: `$ npx chaffjs report.md --compact\n\n${COUNTS_MARKER}\n`,
        },
      ],
    });
  });

  it("file= の無い塊は文書にせず、chaffjs で始まらない塊は画面にしない", () => {
    const other = [`${FENCE}markdown`, "# Draft", FENCE, `${FENCE}bash`, `npx chaffjs x.md`, FENCE, ""].join("\n");
    assert.deepEqual(screensIn(other), { documents: {}, screens: [] });
    assert.deepEqual(screensIn(""), { documents: {}, screens: [] });
  });
});

describe("screensIn: 字下げした塊", () => {
  it("箇条書きの下で字下げした塊も、字下げを外して読む", () => {
    const listed = ["1. Run it:", "", `   ${FENCE}`, "   $ npx chaffjs a.md --compact", "", `   ${COUNTS_MARKER}`, `   ${FENCE}`, ""].join("\n");
    assert.deepEqual(screensIn(listed).screens, [
      { command: "$ npx chaffjs a.md --compact", args: ["a.md", "--compact"], shown: `$ npx chaffjs a.md --compact\n\n${COUNTS_MARKER}\n` },
    ]);
  });
});

describe("screensIn: 長い塊", () => {
  it("``` を含む ```` の塊は、同じ長さの ```` で閉じる。後の塊の組も崩れない", () => {
    const long = ["````", "$ npx chaffjs fix-plan a.md", "", "```bash", "npx chaffjs a.md", "```", "````", "", "```markdown file=a.md", "# A", "```", ""].join(
      "\n",
    );
    const { documents, screens } = screensIn(long);
    assert.deepEqual(documents, { "a.md": "# A\n" });
    assert.deepEqual(
      screens.map((screen) => screen.shown),
      ["$ npx chaffjs fix-plan a.md\n\n```bash\nnpx chaffjs a.md\n```\n"],
    );
  });
});

describe("argsOf", () => {
  it("引用符の中の空白と、\\ で逃がした空白では切らない", () => {
    assert.deepEqual(argsOf('$ npx chaffjs relax x --why "a b c"'), ["relax", "x", "--why", "a b c"]);
    assert.deepEqual(argsOf("$ npx chaffjs off 'x y'"), ["off", "x y"]);
    assert.deepEqual(argsOf("$ npx chaffjs my\\ file.md --compact"), ["my file.md", "--compact"]);
    assert.deepEqual(argsOf("$ npx chaffjs "), []);
  });
});

describe("notRunBlock", () => {
  it("一覧の見出しと、その下の rule の行だけを返す（英語・日本語・1 件）", () => {
    const en = ["  No findings", "", "  2 rules did not run:", "      a (still experimental)", "      b (not a rule for en)", "", "next"].join("\n");
    assert.equal(notRunBlock(en), "  2 rules did not run:\n      a (still experimental)\n      b (not a rule for en)");
    assert.equal(notRunBlock("  1 rule did not run:\n      a (still experimental)"), "  1 rule did not run:\n      a (still experimental)");
    assert.equal(notRunBlock("  1 件の rule は動いていません:\n      a（まだ試験中のため）\n"), "  1 件の rule は動いていません:\n      a（まだ試験中のため）");
  });

  it("一覧の無い画面・空の出力からは何も返さない", () => {
    assert.equal(notRunBlock("  No findings\n"), undefined);
    assert.equal(notRunBlock(""), undefined);
  });

  it("一覧の下のヒント（試験中の rule を一つ名指しする行）も一覧に含める。名指しする rule は rule が増えると変わる", () => {
    const hint = "  Turn on one experimental rule alone by naming it: npx chaffjs enable a (the same as rules: { a: normal } in chaff.yaml).";
    const en = ["  1 rule did not run:", "      a (still experimental)", "", hint, "", "next"].join("\n");
    assert.equal(notRunBlock(en), ["  1 rule did not run:", "      a (still experimental)", "", hint].join("\n"));
    const ja =
      "  1 件の rule は動いていません:\n      a（まだ試験中のため）\n\n  試験中のルールを 1 つだけ動かすには、npx chaffjs enable a のように名指しします。";
    assert.equal(notRunBlock(ja), ja);
    assert.equal(notRunBlock("  1 rule did not run:\n      a (x)\n\n  Something else"), "  1 rule did not run:\n      a (x)");
  });

  it("fix-plan の「動かなかったルール」の節は、次の節の前の空行までを返す", () => {
    const plan = ["## Spots", "", "- x", "", "## Rules that did not run", "", "- `a`: why", "- `b`: why", "", "## Check after rewriting", ""].join("\n");
    assert.equal(notRunBlock(plan), "## Rules that did not run\n\n- `a`: why\n- `b`: why");
    assert.equal(notRunBlock("## 動かなかったルール\n\n- `a`: 理由\n"), "## 動かなかったルール\n\n- `a`: 理由");
    assert.equal(notRunBlock("## Rules that did not run (and more)\n- `a`: why"), undefined);
  });
});

describe("notRunRow", () => {
  const grade = [
    "54 not run",
    "  abstract-length                 3 outputs  the genre does not check it",
    "  cite                            2 outputs  no citations given",
    "",
  ].join("\n");

  it("名指しした rule の行を、chaff が詰めたとおりに返す", () => {
    assert.equal(notRunRow(grade, "cite"), "  cite                            2 outputs  no citations given");
  });

  it("id の頭が同じだけの行、字下げの無い行、無い rule には何も返さない", () => {
    assert.equal(notRunRow(grade, "abstract"), undefined);
    assert.equal(notRunRow("cite 2 outputs", "cite"), undefined);
    assert.equal(notRunRow(grade, "compare"), undefined);
  });

  it("{not-run: <rule>} の行を埋め、chaff が出さなければ足りない印として言う", () => {
    const shown = `$ x\n  ${notRunRowMarker("cite")}\n  ${notRunRowMarker("compare")}`;
    assert.ok(hasFill(shown));
    const fills = fillsFor(shown, grade);
    assert.deepEqual(fills, { rows: { cite: "  cite                            2 outputs  no citations given" } });
    assert.deepEqual(missingFills(shown, fills), [notRunRowMarker("compare")]);
    assert.equal(
      withScreenFills(`$ x\n  ${notRunRowMarker("cite")}`, fills, "en/x.md"),
      "$ x\n  cite                            2 outputs  no citations given",
    );
    assert.throws(() => withScreenFills(shown, fills, "en/x.md"), /en\/x\.md.*\{not-run: compare\}/u);
  });
});

describe("countsLine", () => {
  it("--compact の最後の行を、英語・日本語・単数・動いていない rule の無いものまで読む", () => {
    assert.equal(countsLine("x\n\n3 findings, 97 rules not run\n"), "3 findings, 97 rules not run");
    assert.equal(countsLine("1 finding, 1 rule not run"), "1 finding, 1 rule not run");
    assert.equal(countsLine("0 findings"), "0 findings");
    assert.equal(countsLine("指摘 4 件、動いていない rule 16 件"), "指摘 4 件、動いていない rule 16 件");
    assert.equal(countsLine("指摘 0 件"), "指摘 0 件");
  });

  it("集計の行の無い出力・文中の数からは何も返さない", () => {
    assert.equal(countsLine(""), undefined);
    assert.equal(countsLine("  Wrote SARIF: out.sarif (6 findings)"), undefined);
    assert.equal(countsLine("  3 findings (2 warnings, 1 info)"), undefined);
  });
});

describe("fillsFor と missingFills", () => {
  const output = "a.md\n\n  1 rule did not run:\n      x (still experimental)\n\n0 findings, 1 rule not run\n";

  it("画面の持つ印のぶんだけを作る", () => {
    assert.deepEqual(fillsFor(`$ x\n${NOT_RUN_MARKER}\n${COUNTS_MARKER}`, output), {
      notRun: "  1 rule did not run:\n      x (still experimental)",
      counts: "0 findings, 1 rule not run",
    });
    assert.deepEqual(fillsFor(`$ x\n${COUNTS_MARKER}`, output), { counts: "0 findings, 1 rule not run" });
    assert.deepEqual(fillsFor("$ x\n0 findings", output), {});
  });

  it("chaff が出さなかった印を挙げる", () => {
    assert.deepEqual(missingFills(`$ x\n${NOT_RUN_MARKER}\n${COUNTS_MARKER}`, {}), [NOT_RUN_MARKER, COUNTS_MARKER]);
    assert.deepEqual(missingFills(`$ x\n${COUNTS_MARKER}`, { counts: "0 findings" }), []);
  });
});

describe("screenMatches", () => {
  it("行ごとに同じなら合う。行末の空白と最後の空行は見ない", () => {
    assert.equal(screenMatches("$ x\n\na  \nb\n\n", "$ x\n\na\nb"), true);
    assert.equal(screenMatches("$ x\n\na", "$ x\n\nb"), false);
    assert.equal(screenMatches("$ x\n\na", "$ x\n\na\nb"), false);
    assert.equal(screenMatches("$ x\n\na\nb", "$ x\n\na"), false);
  });

  it("「…」だけの行は、chaff の 0 行以上に合う", () => {
    assert.equal(screenMatches("$ x\n…\nz", "$ x\na\nb\nz"), true);
    assert.equal(screenMatches("$ x\n  …\nz", "$ x\nz"), true);
    assert.equal(screenMatches("$ x\n…", "$ x\na\nb"), true);
    assert.equal(screenMatches("$ x\n…\nz", "$ x\na\nb"), false);
    assert.equal(screenMatches("$ x\n…\nb\n…\nd", "$ x\na\nb\nc\nd"), true);
  });

  it("「…」が多く、同じ行が続いても、すぐに終わる", () => {
    const shown = ["$ x", ...Array.from({ length: 40 }, () => ["…", "a"]).flat(), "…", "z"].join("\n");
    const actual = ["$ x", ...Array.from({ length: 400 }, () => "a")].join("\n");
    assert.equal(screenMatches(shown, actual), false);
    assert.equal(screenMatches(shown, `${actual}\nz`), true);
  });
});

describe("withScreenFills と fillPage", () => {
  const fills = { notRun: "  1 rule did not run:\n      a (still experimental)", counts: "0 findings, 1 rule not run" };

  it("印の行を、作ったものに置き換える", () => {
    assert.equal(
      withScreenFills(`$ npx chaffjs report.md\n\n  ${NOT_RUN_MARKER}\n\n${COUNTS_MARKER}\n`, fills, "en/x.md"),
      "$ npx chaffjs report.md\n\n  1 rule did not run:\n      a (still experimental)\n\n0 findings, 1 rule not run\n",
    );
    assert.equal(withScreenFills("$ npx chaffjs other.md\n", fills, "en/x.md"), "$ npx chaffjs other.md\n");
  });

  it("作られていない印なら止まり、場所と印を言う。印のまま出さない", () => {
    assert.throws(() => withScreenFills(`$ npx chaffjs a.md\n${COUNTS_MARKER}`, {}, "en/x.md"), /en\/x\.md.*\{counts\}/u);
  });

  it("ページの画面を順に埋め、コマンドが食い違えば止まる", () => {
    const codes = [`$ npx chaffjs a.md\n${COUNTS_MARKER}`, `$ npx chaffjs a.md\n${COUNTS_MARKER}`];
    const made = [
      { command: "$ npx chaffjs a.md", fills: { counts: "1 finding" } },
      { command: "$ npx chaffjs a.md", fills: { counts: "0 findings" } },
    ];
    assert.deepEqual(fillPage(codes, made, "en/x.md"), ["$ npx chaffjs a.md\n1 finding", "$ npx chaffjs a.md\n0 findings"]);
    assert.throws(() => fillPage(codes, made.slice(0, 1), "en/x.md"), /en\/x\.md.*screen 2/u);
    assert.throws(() => fillPage(["$ npx chaffjs b.md\n{counts}"], made, "en/x.md"), /b\.md/u);
  });
});

describe("手引きのページ", () => {
  const pages = ["ja", "en"].flatMap((language) =>
    readdirSync(join(GUIDE, language))
      .filter((file) => file.endsWith(".md") && file !== "STYLE.md")
      .map((file) => ({ language, file, text: readFileSync(join(GUIDE, language, file), "utf8") })),
  );

  it("一覧を書き写したページが残っていない（見出しの行があれば、印に置き換える）", () => {
    pages.forEach(({ language, file, text }) => assert.equal(notRunBlock(text), undefined, `${language}/${file}`));
  });

  // 一覧の下のヒントは、試験中の rule のうち名前が先頭のものを名指しする。grade の一覧の行は、いちばん長い id に合わせて詰める。
  const ALONE_HINT = /^ *(?:Turn on one experimental rule alone by naming it:|試験中のルールを 1 つだけ動かすには、)/u;
  const GRADE_ROW = /^\s+[a-z][a-z0-9-]*\s+\d+ (?:outputs?|件の出力) {2}/u;

  it("一覧の下のヒントや、詰めた一覧の 1 行を書き写したページが残っていない（{not-run} と {not-run: <rule>} に置き換える）", () => {
    const copied = pages.flatMap(({ language, file, text }) =>
      text
        .split("\n")
        .filter((line) => ALONE_HINT.test(line) || GRADE_ROW.test(line))
        .map((line) => `${language}/${file}: ${line.trim()}`),
    );
    assert.deepEqual(copied, []);
  });

  const screensOf = (checked: boolean) =>
    pages.flatMap(({ language, file, text }) =>
      screensIn(text)
        .screens.filter(({ command }) => (UNCHECKED[`${language}/${file}`]?.[command] === undefined) === checked)
        .map(({ command, shown }) => ({ where: `${language}/${file}: ${command}`, shown })),
    );

  it("--compact の集計の行を書き写した画面が残っていない（印に置き換える）", () => {
    screensOf(true).forEach(({ where, shown }) => assert.equal(countsLine(shown), undefined, where));
  });

  it("かけない画面は印を持たない（埋める実行が無いので、出力をそのまま書く）", () => {
    screensOf(false).forEach(({ where, shown }) => assert.equal(hasFill(shown), false, where));
  });
});
