import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { ownEnd } from "../packages/chaff/src/trailing-aside.ts";
import { endingTokens, lastContent } from "../packages/chaff/src/sentence-shape.ts";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

/** The sentence's own words, before any aside ownEnd cuts off. */
const own = (text: string): string => text.slice(0, ownEnd(text));

const endingOf = (source: string): string[] =>
  ja
    .segment(source)
    .sentences.map((sentence) =>
      endingTokens(sentence)
        .map((token) => token.surface)
        .join(""),
    )
    .filter((ending) => ending !== "");

// 厚生労働省「ノロウイルスに関するQ&A」の一節。注記の中の括弧が入れ子になっている。
const NOROVIRUS_NOTE =
  "（この際、次亜塩素酸ナトリウム（塩素濃度約1,000 ppm）や亜塩素酸水（遊離塩素濃度100 ppm（含量 亜塩素酸として0.2％≒2,000 ppm以上））を入れることが望ましい。）";

describe("ownEnd: a trailing aside is a closed bracket after the predicate", () => {
  it("cuts a cross-reference before or after the full stop", () => {
    assert.equal(own("これを最優先制約とする（§17）。"), "これを最優先制約とする");
    assert.equal(own("これを最優先制約とする。（§17）"), "これを最優先制約とする。");
    assert.equal(own("重要です（§3）。 \n"), "重要です");
  });

  it("cuts a closed aside after a bracket the splitter left open", () => {
    assert.equal(own("（閉じない（§3）。"), "（閉じない");
  });

  it("cuts stacked asides, and a closed nested one whole", () => {
    assert.equal(own("上限は（件数）とする（§17（2））。"), "上限は（件数）とする");
    assert.equal(own("とする（§3）（注）。"), "とする");
    assert.equal(own("全ての利用目的（※3）（ただし、一定の場合（※4）を除く。）"), "全ての利用目的");
  });

  it("keeps a note that is the whole sentence, and looks inside it", () => {
    assert.equal(own(NOROVIRUS_NOTE), NOROVIRUS_NOTE.slice(0, -1));
    assert.equal(own("（詳細は別紙に記す（§3）。）"), "（詳細は別紙に記す");
    assert.equal(own("（詳細は別紙に記す（§3））。"), "（詳細は別紙に記す");
    assert.equal(own("(This is a note.)"), "(This is a note.");
  });

  it("keeps a note that follows a finished sentence and ends with 。）", () => {
    assert.equal(own("廃棄します。（この際、袋を使う。）"), "廃棄します。（この際、袋を使う。");
    assert.equal(own("廃棄します。（この際、袋を使う（注）。）"), "廃棄します。（この際、袋を使う");
    assert.equal(own("開始は10時。 （詳細は後日周知。）"), "開始は10時。 （詳細は後日周知。");
    assert.equal(own("廃棄します。（この際、袋を使う。）。"), "廃棄します。（この際、袋を使う。");
    assert.equal(own("日時：10時から16時\n（※詳細は後日周知。）"), "日時：10時から16時\n（※詳細は後日周知。");
    assert.equal(own("日時：10時から16時\r（※詳細は後日周知。）"), "日時：10時から16時\r（※詳細は後日周知。");
  });

  it("cuts a bracketed proviso after a predicate or a noun, even when it ends with 。）", () => {
    assert.equal(own("設立に関する費用（法務省令で定めるものを除く。）"), "設立に関する費用");
    assert.equal(own("会見資料（PDF）（詳細は更新履歴に記載しています。）"), "会見資料");
    assert.equal(own("廃棄します。（注：袋は二重）"), "廃棄します。");
  });

  it("cuts a bracketed sentence that the outer full stop follows (。）。)", () => {
    assert.equal(own("欧州連合の国を指す（ただし、英国は含まない。）。"), "欧州連合の国を指す");
    assert.equal(own("支払った医療費であること（未払いの分は翌年の対象となります。）。"), "支払った医療費であること");
  });

  it("reads a statute-length run of asides without deep recursion", () => {
    const RUN = 20_000;
    assert.equal(ownEnd(`本文${"（1）".repeat(RUN)}。`), "本文".length);
  });

  it("leaves text without a closed trailing bracket whole", () => {
    ["", "。", "）", "（", "これで終わる。", "A（B）C）。", "（§17", "括弧（は）途中にある。"].forEach((text) => assert.equal(ownEnd(text), text.length, text));
  });
});

describe("the ending chaff reads for a bracketed note", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("finds the predicate of a note whose last inner bracket is nested", () => {
    assert.deepEqual(endingOf(`廃棄します。${NOROVIRUS_NOTE}`), ["します", "望ましい"]);
  });

  it("finds the predicate inside a note that ends with 。）", () => {
    assert.deepEqual(endingOf("（詳細は別紙に記します（§3）。）"), ["記します"]);
  });

  it("still skips a cross-reference aside", () => {
    assert.deepEqual(endingOf("この件は重要です（§3）。"), ["重要です"]);
    const [sentence] = ja.segment("これを最優先制約とする（§17）。").sentences;
    assert.equal(sentence === undefined ? undefined : lastContent(sentence)?.surface, "する");
  });

  it("no-mixed-desumasu counts the note's own ending, both ways", () => {
    const polite = "袋に入れます。手袋を使います。床を拭きます。";
    assert.ok(firedRules(ja, `${polite}廃棄します。${NOROVIRUS_NOTE}`).includes("no-mixed-desumasu"));
    assert.ok(!firedRules(ja, `${polite}廃棄します。（この際、袋を二重にします（注）。）`).includes("no-mixed-desumasu"));
    assert.ok(!firedRules(ja, `${polite}対象は設立に関する費用（法務省令で定めるものを除く。）`).includes("no-mixed-desumasu"));
  });
});
