import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { runInTitleParts } from "../packages/chaff/src/detectors/run-in-title.ts";

// max-sentence-length and a link title a converted page runs into the blurb after it on one line. The title and the blurb
// are measured apart; a long blurb, and prose that only looks like it, is still reported. Self-written text.

const RULE = "max-sentence-length";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja, "a.md", "business/proposal").findings;

const TITLE = "「地域」×「図書館」アイデアソン";
const PLAIN_TITLE = "市民図書館アイデアソン";
const BLURB =
  "「地域」×「図書館」の取組をさらに広げ、市内の図書館の使い方の見直し、子どもから高齢者まで誰もが使いやすい蔵書検索の提供、図書館の資料を生かした新しい地域活動の創出を目的として、2024年5月7日（火）から6月11日（火）まで、「地域」×「図書館」アイデアソンを開催しました。";
const PLAIN_BLURB = BLURB.replace("「地域」×「図書館」アイデアソンを", `${PLAIN_TITLE}を`);
const LONG_BLURB = BLURB.replace("を目的として", "と、職員の働き方の改善と、近隣の学校との連携を目的として");

describe("runInTitleParts", () => {
  it("reads a bracketed title, or a title the sentence repeats, before the first space", () => {
    assert.deepEqual(runInTitleParts(`${TITLE} ${BLURB}`), [TITLE, BLURB]);
    assert.deepEqual(runInTitleParts(`${PLAIN_TITLE} ${PLAIN_BLURB}`), [PLAIN_TITLE, PLAIN_BLURB]);
  });

  it("leaves a head that is a clause, holds a stop, a comma or an open bracket, is short, or is not repeated", () => {
    [
      `「はい」と答えた ${BLURB}`,
      `「地域」、「図書館」 ${BLURB}`,
      `「Library Lab」は、${BLURB}`,
      `「Library Lab」 「Library ${BLURB}`,
      `図書館 ${BLURB}`,
      `中央公民館講座 ${BLURB}`,
      BLURB,
      "",
    ].forEach((text) => assert.equal(runInTitleParts(text), undefined, text));
  });
});

describe("max-sentence-length: a link title run into its blurb", () => {
  it("measures the title and the blurb apart", () => {
    assert.deepEqual(findingsOf(BLURB), []);
    assert.deepEqual(findingsOf(`${TITLE} ${BLURB}`), []);
    assert.deepEqual(findingsOf(`${PLAIN_TITLE} ${PLAIN_BLURB}`), []);
  });

  it("still reports a blurb that is long by itself", () => {
    assert.equal(findingsOf(`${TITLE} ${LONG_BLURB}`).length, 1);
  });

  it("still reports a long sentence whose head is a clause or a bracketed name cut at its space, or that does not open the line", () => {
    assert.equal(findingsOf(`「はい」と答えた ${BLURB}`).length, 1);
    assert.equal(findingsOf(`「Library Lab」は、${BLURB}`).length, 1);
    assert.equal(findingsOf(`中央公民館講座 ${BLURB}`).length, 1);
    assert.equal(findingsOf(`催しの案内です。${TITLE} ${BLURB}`).length, 1);
  });
});
