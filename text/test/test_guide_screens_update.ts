import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fillsFor, replaceScreens, screenMatches, screensIn } from "../scripts/guide-screens-parse.ts";
import { commonLines, mergedLines, stretchLines, updatedScreen } from "../scripts/guide-screens-update.ts";
import { COUNTS_MARKER, NOT_RUN_MARKER, withScreenFills } from "../site/src/lib/screenFills.ts";

// yarn screens:update は、手引きの画面を chaff の今の出力に書き直す。ページと chaff が共有する行は残し、
// 「…」の行はできるだけ元の場所に残し、{not-run} と {counts} は印のまま残す。

const FENCE = "```";
const PROMPT = "$ npx chaffjs a.md";
const screen = (...output: string[]): string => [PROMPT, "", ...output, ""].join("\n");

describe("commonLines", () => {
  it("両方にある行を、順番を保って最も多く対応させる", () => {
    assert.deepEqual(commonLines(["a", "b", "c"], ["a", "x", "c"]), [
      { shown: 0, actual: 0 },
      { shown: 2, actual: 2 },
    ]);
  });

  it("「…」の行は、chaff が「…」を出していても対応させない", () => {
    assert.deepEqual(commonLines(["…"], ["…"]), []);
  });

  it("どちらかが空なら何も対応しない", () => {
    assert.deepEqual(commonLines([], ["a"]), []);
    assert.deepEqual(commonLines(["a"], []), []);
  });
});

describe("mergedLines", () => {
  it("「…」の無い間は chaff の行に置き換える", () => {
    assert.deepEqual(mergedLines(["a", "old", "c"], ["a", "new", "more", "c"]), ["a", "new", "more", "c"]);
  });

  it("「…」のあった間は「…」の一行のまま残す", () => {
    assert.deepEqual(mergedLines(["a", "  …", "c"], ["a", "x", "y", "c", "d"]), ["a", "  …", "c", "d"]);
  });

  it("先頭と末尾の「…」も残す", () => {
    assert.deepEqual(mergedLines(["…", "b", "…"], ["a", "b", "c"]), ["…", "b", "…"]);
  });

  it("「…」が何行も飲まない所でも、元の場所に残す", () => {
    assert.deepEqual(mergedLines(["a", "…", "b"], ["a", "b"]), ["a", "…", "b"]);
  });

  it("chaff が何も出さなければ、「…」の無い画面は空になる", () => {
    assert.deepEqual(mergedLines(["a", "b"], []), []);
  });
});

describe("updatedScreen", () => {
  it("書き直した画面は chaff の出力と合う", () => {
    const shown = screen("  a.md", "    old finding", "  …", "  end");
    const actual = screen("  a.md", "    new finding", "    another", "    hidden", "  end");
    const updated = updatedScreen(shown, actual);
    assert.equal(updated, screen("  a.md", "    new finding", "  …", "  end"));
    assert.ok(screenMatches(updated, actual));
  });

  it("{not-run} と {counts} は、chaff がその行を出す限り印のまま残す", () => {
    const shown = screen("  a.md", "    old", "", `  ${NOT_RUN_MARKER}`, "", COUNTS_MARKER);
    const actual = screen("  a.md", "    new", "", "  2 rules did not run:", "      x — why", "      y — why", "", "1 finding, 2 rules not run");
    const updated = updatedScreen(shown, actual);
    assert.equal(updated, screen("  a.md", "    new", "", `  ${NOT_RUN_MARKER}`, "", COUNTS_MARKER));
    assert.ok(screenMatches(withScreenFills(updated, fillsFor(updated, actual), "test"), actual));
  });

  it("chaff がもう出さない印の行は、chaff の行に置き換わる", () => {
    const shown = screen("  a.md", "", `  ${NOT_RUN_MARKER}`);
    const actual = screen("  No findings");
    assert.equal(updatedScreen(shown, actual), screen("  No findings"));
  });

  it("行末の空白は落とし、前後の空行はページのまま", () => {
    const shown = [PROMPT, "", "", "old", "", ""].join("\n");
    assert.equal(updatedScreen(shown, screen("new   ")), [PROMPT, "", "", "new", "", ""].join("\n"));
  });

  it("もう合っている画面は変わらない", () => {
    const shown = screen("  a.md", "  …", "  end");
    assert.equal(updatedScreen(shown, screen("  a.md", "  x", "  end")), shown);
  });
});

describe("replaceScreens", () => {
  const page = [
    `${FENCE}markdown file=a.md`,
    "# A",
    FENCE,
    "",
    "- item",
    "",
    `  ${FENCE}`,
    `  ${PROMPT}`,
    "",
    "    old",
    `  ${FENCE}`,
    "",
    "<!-- chaff-screen: other -->",
    `${FENCE}${FENCE.slice(0, 1)}`,
    "$ npx chaffjs b.md",
    "",
    "keep",
    `${FENCE}${FENCE.slice(0, 1)}`,
    "",
  ].join("\n");

  it("n 番目の画面だけを、塊の字下げを保って置き換える", () => {
    const replaced = replaceScreens(page, [screen("  new"), undefined]);
    assert.equal(replaced, page.replace("    old", "    new"));
  });

  it("書き換えた後も、同じ画面として読める", () => {
    const second = ["$ npx chaffjs b.md", "", "changed", ""].join("\n");
    const replaced = replaceScreens(page, [screen("  first"), second]);
    assert.deepEqual(
      screensIn(replaced).screens.map((each) => each.shown),
      [screen("  first"), second],
    );
  });

  it("何も渡さなければページは変わらない", () => {
    assert.equal(replaceScreens(page, []), page);
  });
});

describe("stretchLines", () => {
  it("「…」の前と後にページが見せた行の数だけ、chaff の行を残す", () => {
    assert.deepEqual(stretchLines(["old", "…", "tail"], ["x", "y", "z", "w"]), ["x", "…", "w"]);
  });

  it("chaff の行が足りなければ「…」だけにする", () => {
    assert.deepEqual(stretchLines(["a", "…", "b"], ["x"]), ["…"]);
  });
});

// 生成した画面と出力の組で、書き直した画面がいつも chaff の出力と合うことを確かめる。
const SEED = 20261003;
const CASES = 500;
const MAX_LINES = 8;
const ALPHABET = ["a", "b", "c", "…", ""];
const MODULUS = 2147483648;
const MULTIPLIER = 1103515245;
const INCREMENT = 12345;

const generator = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value * MULTIPLIER + INCREMENT) % MODULUS;
    return state.value / MODULUS;
  };
};

const linesFrom = (random: () => number, alphabet: readonly string[]): string[] =>
  Array.from({ length: Math.floor(random() * MAX_LINES) }, () => alphabet[Math.floor(random() * alphabet.length)] ?? "");

describe("updatedScreen（生成した入力）", () => {
  it(`seed ${String(SEED)}: どの組でも、書き直した画面は chaff の出力と合う`, () => {
    const random = generator(SEED);
    const failing = Array.from({ length: CASES }, () => ({
      shown: screen(...linesFrom(random, ALPHABET)),
      actual: screen(
        ...linesFrom(
          random,
          ALPHABET.filter((line) => line !== "…"),
        ),
      ),
    })).filter(({ shown, actual }) => !screenMatches(updatedScreen(shown, actual), actual));
    assert.deepEqual(failing, []);
  });
});
