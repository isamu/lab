import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { documentArg, notRunBlock, screensIn } from "../scripts/guide-screens-parse.ts";
import { hasDocumentIn } from "../scripts/guide-screens.ts";
import { NOT_RUN_MARKER, withNotRunList } from "../site/src/lib/notRunLists.ts";

// 手引きの画面にある「動いていない rule」の一覧は、ページに書き写さず、サイトを作るときに chaff の出力から入れる。
// rule を足す PR が、手引きのページを書き換えなくて済むため。

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
  FENCE,
  "$ npx chaffjs report.md --compact",
  "",
  "0 findings",
  FENCE,
  "",
].join("\n");

describe("screensIn", () => {
  it("file= の付いた markdown の塊を文書として、印のある画面をコマンドと引数として読む", () => {
    assert.deepEqual(screensIn(page), {
      documents: { "report.md": "# Report\n\nBody.\n" },
      screens: [{ command: "$ npx chaffjs report.md --genre business/report", args: ["report.md", "--genre", "business/report"] }],
    });
  });

  it("file= の無い塊は文書にせず、印の無い画面・chaffjs で始まらない塊は数えない", () => {
    const other = [`${FENCE}markdown`, "# Draft", FENCE, `${FENCE}bash`, `npm i chaffjs`, `  ${NOT_RUN_MARKER}`, FENCE, ""].join("\n");
    assert.deepEqual(screensIn(other), { documents: {}, screens: [] });
    assert.deepEqual(screensIn(""), { documents: {}, screens: [] });
  });
});

describe("documentArg", () => {
  const known = (name: string): boolean => name === "article.md";

  it("オプションの前でも後でも、文書のある引数を返す", () => {
    assert.equal(documentArg(["article.md", "--genre", "blog/tech"], known), "article.md");
    assert.equal(documentArg(["--genre", "blog/tech", "--experimental", "article.md"], known), "article.md");
  });

  it("文書のある引数が無ければ何も返さない", () => {
    assert.equal(documentArg(["--compact", "other.md"], known), undefined);
    assert.equal(documentArg([], known), undefined);
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
});

describe("withNotRunList", () => {
  const lists = { "$ npx chaffjs report.md": "  1 rule did not run:\n      a (still experimental)" };

  it("印の行を、そのページとコマンドの一覧に置き換える", () => {
    assert.equal(
      withNotRunList(`$ npx chaffjs report.md\n\n  ${NOT_RUN_MARKER}\n`, lists, "en/x.md"),
      "$ npx chaffjs report.md\n\n  1 rule did not run:\n      a (still experimental)\n",
    );
  });

  it("印の無い塊はそのまま返す", () => {
    assert.equal(withNotRunList("$ npx chaffjs other.md\n", lists, "en/x.md"), "$ npx chaffjs other.md\n");
  });

  it("一覧が作られていない画面なら止まり、ページとコマンドを言う。印のまま出さない", () => {
    assert.throws(() => withNotRunList(`$ npx chaffjs other.md\n  ${NOT_RUN_MARKER}`, lists, "en/x.md"), /en\/x\.md.*other\.md/u);
  });
});

describe("手引きのページ", () => {
  const pages = ["ja", "en"].flatMap((language) =>
    readdirSync(join(GUIDE, language))
      .filter((file) => file.endsWith(".md") && file !== "STYLE.md")
      .map((file) => ({ language, file })),
  );

  it("印のある画面は、読む文書をページか site/src/screens/<言語>/ に持つ", () => {
    pages.forEach(({ language, file }) => {
      const { documents, screens } = screensIn(readFileSync(join(GUIDE, language, file), "utf8"));
      screens.forEach(({ command, args }) => {
        const name = documentArg(args, hasDocumentIn(language, documents));
        assert.ok(name !== undefined, `${language}/${file}: ${command}`);
      });
    });
  });

  it("一覧を書き写したページが残っていない（見出しの行があれば、印に置き換える）", () => {
    pages.forEach(({ language, file }) => {
      const text = readFileSync(join(GUIDE, language, file), "utf8");
      assert.equal(notRunBlock(text), undefined, `${language}/${file}`);
    });
  });
});
