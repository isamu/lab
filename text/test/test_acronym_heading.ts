import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 見出しの中で展開した略語。見出しは文にならないので、本文と同じ展開の形を見出しの文字列でも探す。
// 例文は自作と、NOAA AOML のハリケーン FAQ（米国政府の著作物、パブリックドメイン）の見出し。

/** 見出しのあとに、同じ略語を本文で使う文書。 */
const withUse = (heading: string, acronym: string): string => `# Storm surge\n\n${heading}\n\nThe ${acronym} for the cell is 7.1 ft.\n`;

/** [何の形か, 見出し, 見る略語]。 */
type Case = readonly [string, string, string];

const DEFINED: readonly Case[] = [
  ["名前のあとの括弧の略語（AOML）", "##### Maximum Envelope of Water (MEOW) runs", "MEOW"],
  ["見出しが括弧で終わる", "## Maximum Envelope of Water (MEOW)", "MEOW"],
  ["略語のあとの括弧の名前", "## MEOW (Maximum Envelope of Water)", "MEOW"],
  ["角括弧の略語で、大文字の語の頭文字が揃う", "## Sea, Lake, and Overland Surges from Hurricanes [SLOSH]", "SLOSH"],
  ["Setext の見出し", "Maximum Envelope of Water (MEOW)\n---", "MEOW"],
  ["深さ 1 の見出し", "# Maximum Envelope of Water (MEOW)", "MEOW"],
];

const REPORTED: readonly Case[] = [
  ["見出しに略語だけがあり、展開が無い", "## MEOW runs", "MEOW"],
  ["見出しが略語だけで、次の段落が名前でない", "## MEOW", "MEOW"],
  ["角括弧の略語で、頭文字が揃わない", "## Storm surge products [MEOW]", "MEOW"],
  ["見出しが別の略語を展開している", "## Storm surge runs of the Maximum Of Maximums (MOM)", "MEOW"],
  ["括弧の中が略語でない語", "## MEOW runs (overview)", "MEOW"],
  ["括弧の略語が添え書きで、見出しの語から文字を拾えない（MulmoCast の記事）", "## 2. Creating with Your Own AI (LLM)", "LLM"],
  ["略語のあとの括弧が名前でない", "## MEOW (Beta)", "MEOW"],
  ["見出しの語から文字は拾えるが、展開の形でない", "## Maximum Envelope of Water and MEOW runs", "MEOW"],
];

describe("undefined-acronym：見出しの中の展開", () => {
  DEFINED.forEach(([form, heading, acronym]) => {
    it(`valid: ${form}`, () => assert.deepEqual(reportedAcronyms(en, withUse(heading, acronym)), [], heading));
  });

  REPORTED.forEach(([form, heading, acronym]) => {
    it(`invalid: ${form}`, () => assert.deepEqual(reportedAcronyms(en, withUse(heading, acronym)), [acronym], heading));
  });

  it("AOML：2 つの見出しで展開した MEOW と MOM は説明済み、見出しで展開していない SLOSH は数える", () => {
    const source = [
      "# Storm surge",
      "##### Maximum Envelope of Water (MEOW) runs",
      "Several SLOSH runs are performed. In this case, the MEOW for the cell is 7.1 ft.",
      "##### Maximum of MEOW (MOM) runs",
      "MOMs are created by pooling all the MEOWs. There is 1 MOM per storm category.",
      "",
    ].join("\n\n");
    assert.deepEqual(reportedAcronyms(en, source), ["SLOSH"]);
  });

  it("本文だけで使う略語は、見出しの展開が無ければ今までどおり数える", () => {
    const source = "# Storm surge\n\n## Products\n\nThe MEOW for the cell is 7.1 ft.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["MEOW"]);
  });

  it("日本語の見出し：英語の名前は揃えば説明済み、日本語の名前は確かめられない", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 用語\n\n## Service Level Agreement（SLA）\n\nSLA を結ぶ。\n"), []);
    assert.deepEqual(reportedAcronyms(ja, "# 用語\n\n## サービス品質の約束（SLA）\n\nSLA を結ぶ。\n"), ["SLA"]);
  });
});
