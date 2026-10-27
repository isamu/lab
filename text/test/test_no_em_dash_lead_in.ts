import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { introducesList, opensLine } from "../packages/chaff/src/detectors/lead-in-dash.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// A statute introduces each enumeration with an em dash ending its paragraph ("For the purpose of this subchapter—" over
// "(1) "agency" means…"). Those dashes are the form of the list, as a colon would be, and no-em-dash counted them as a
// heavy hand with dashes. Lines from 5 U.S.C. 551 (public domain, chaff-corpus); the rest is self-written.

const BULK = "We shipped the release and reported the numbers to the team. ".repeat(40);
const fires = (source: string): boolean => firedRules(en, source, "legal/statute").includes("no-em-dash");

const ENUMERATION = [
  "For the purpose of this subchapter—",
  '(1) "agency" means each authority of the Government of the United States, but does not include—',
  "(A) the Congress;",
  "(B) the courts of the United States;",
  '(2) "person" includes an individual, partnership, corporation, association, or public or private organization;',
].join("\n\n");

const dashAt = (source: string): number => source.indexOf("—");

describe("introducesList", () => {
  it("a dash ending its paragraph above a list item introduces the list", () => {
    ["(1) agency", '"(1) agency', "1. Agency", "a) Agency", "- Agency", "• Agency", "  (A) the Congress"].forEach((item) => {
      const source = `For the purpose of this subchapter—\n\n${item}`;
      assert.equal(introducesList(source, dashAt(source)), true, item);
    });
    const spaced = "shall include— \n\n\n(A) the Congress;";
    assert.equal(introducesList(spaced, dashAt(spaced)), true);
    const crlf = "shall include—\r\n\r\n(aa) the Congress;\r\n";
    assert.equal(introducesList(crlf, dashAt(crlf)), true);
  });

  it("a word in brackets or an indented code block below is not a list", () => {
    ["(note) This is an aside.", "    - literal text", "    (1) literal text", "(1)no space"].forEach((line) => {
      const source = `Output ended—\n\n${line}`;
      assert.equal(introducesList(source, dashAt(source)), false, line);
    });
  });

  it("a dash inside its line, above prose, or at the end of the text does not", () => {
    ["The plan—as agreed—ships today.\n\n(1) Next.", "The plan ships today—\n\nThen we rest.", "The plan ships today—", "The plan—\n\nThe. end"].forEach(
      (source) => assert.equal(introducesList(source, dashAt(source)), false, source),
    );
  });
});

describe("no-em-dash: a dash that introduces a list", () => {
  it("valid: enumerations introduced with a dash are not counted", () => {
    assert.equal(fires(`### §551. Definitions\n\n${Array.from({ length: 12 }, () => ENUMERATION).join("\n\n")}\n\n${BULK}`), false);
  });

  it("invalid: as many dashes inside sentences are still counted", () => {
    const prose = "The agency—as the Congress intended—reviews each rule.\n\n".repeat(12);
    assert.equal(fires(`### §551. Definitions\n\n${prose}${BULK}`), true);
  });
});

// A Japanese interview opens each of the interviewer's turns with ―― ("――今後の目標を教えてください。"), a letter signs
// off with "— Nina", and a business email rules off its signature with a line of ―. Each dash opens its line: it marks
// who speaks or where a block ends, not words set off inside a sentence. Self-written text.

const JA_BULK = "工場での経験を生かして、お客さんの質問にその場で答えています。".repeat(30);
const firesJa = (source: string): boolean => firedRules(ja, source, "blog/owned-media").includes("no-em-dash");

const INTERVIEW = [
  "――営業に移ったのはご自身の希望ですか？",
  "いえ、会社からの打診でした。最初は断ろうと思いました。",
  "――実際にやってみてどうでしたか？",
  "最初の半年は苦労しました。見積書の書き方も知りませんでした。",
].join("\n\n");

describe("opensLine", () => {
  it("a dash with only blanks and dashes before it on its line opens the line", () => {
    ["――次の質問です。", "  ――次の質問です。", "— Nina", "――――――――", "　――次の質問です。"].forEach((line) => {
      const source = `前の段落です。\n\n${line}`;
      const first = source.search(/[—―]/u);
      assert.equal(opensLine(source, first), true, line);
      assert.equal(opensLine(source, first + 1), true, line);
    });
    assert.equal(opensLine("――最初の行です。", 0), true);
  });

  it("a dash after a word on its line does not", () => {
    ["新しい料金――来月から――は高い。", "The plan — as agreed — ships.", "- らき☆すた ― 久喜市", "> ――引用の中です。"].forEach((line) => {
      const source = `前の段落です。\n${line}`;
      assert.equal(opensLine(source, source.search(/[—―]/u)), false, line);
    });
  });
});

describe("no-em-dash: a dash that opens its line", () => {
  it("valid: an interview's turns, a sign-off and a rule line are not counted", () => {
    assert.equal(firesJa(`# 社員インタビュー\n\n${Array.from({ length: 6 }, () => INTERVIEW).join("\n\n")}\n\n${JA_BULK}`), false);
    assert.equal(firesJa(`# お詫び\n\n${JA_BULK}\n\n――――――――――――――――\n株式会社サンプル\n――――――――――――――――`), false);
    assert.equal(fires(`${BULK}\n\nThanks for reading.\n\n— Nina`), false);
  });

  it("invalid: as many dashes inside the sentences are still counted", () => {
    const asides = "工場の経験――とくに寸法の勘――が営業で生きています。\n\n".repeat(6);
    assert.equal(firesJa(`# 社員インタビュー\n\n${asides}${JA_BULK}`), true);
  });
});
