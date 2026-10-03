import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UNCHECKED, UNCHECKED_ON_WINDOWS, differingInChildren, guidePages, readGuidePage } from "../scripts/guide-screens.ts";

// 手引きの画面は、その画面の文書に chaff を実際にかけた出力と同じでなければならない。古い画面は、読み手に今の chaff と
// 違うものを見せる。画面の文書は、ページの file= の塊と site/src/screens/<言語>/<ページ>/ に置く。
// かけられない画面は、理由を付けて scripts/guide-screens.ts の UNCHECKED に挙げる。

/** The commands listed for a page that the page does not show. */
const notOnPage = (page: string, commands: readonly string[]): string[] => {
  const [language = "", file = ""] = page.split("/");
  const shown = new Set(readGuidePage({ language, file }).screens.map((screen) => screen.command));
  return commands.filter((command) => !shown.has(command)).map((command) => `${page}: ${command}`);
};

describe("手引きの画面", () => {
  it("どの画面も、その文書に chaff をかけた出力と同じ（「…」の行は何行でも、印の行はその実行から埋める）", async () => {
    const differing = await differingInChildren(guidePages());
    assert.deepEqual(
      differing,
      [],
      "these screens differ from chaff; yarn screens:update rewrites them to what chaff prints (read the diff), and node scripts/guide-screens.ts --check <lang>/<page>.md shows how they differ",
    );
  });

  it("かけない画面の一覧は、どれもページにある", () => {
    assert.deepEqual(
      [...Object.entries(UNCHECKED), ...Object.entries(UNCHECKED_ON_WINDOWS)].flatMap(([page, commands]) => notOnPage(page, Object.keys(commands))),
      [],
    );
  });
});
