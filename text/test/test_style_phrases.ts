import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// Lexicon rules on the phrase detectors: wordy-phrase, weasel-word, homophone-slip, sentence-initial-so, doubled-nado.
// Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, adapter: LanguageAdapter = en, level: "strict" | "normal" = "normal"): readonly string[] =>
  namedRuleRun(rule, source, adapter, "a.md", "business/report", level).findings;

describe("wordy-phrase", () => {
  const RULE = "wordy-phrase";

  it("two sentences with a wordy phrase are reported at normal, one is not", () => {
    const two = "In order to save time, we met online. Due to the fact that the room was booked, we stayed home.\n";
    assert.deepEqual(findingsOf(RULE, two), ['"in order to" can be said in fewer words', '"due to the fact that" can be said in fewer words']);
    assert.deepEqual(findingsOf(RULE, "In order to save time, we met online.\n"), []);
    assert.deepEqual(findingsOf(RULE, "In order to save time, we met online.\n", en, "strict"), ['"in order to" can be said in fewer words']);
  });

  it("matches whole words only, and the short form is not reported", () => {
    assert.deepEqual(findingsOf(RULE, "The border order told us to wait. To save time, we met online.\n", en, "strict"), []);
    assert.deepEqual(findingsOf(RULE, "If the server fails, the job retries. Because it was late, we left.\n", en, "strict"), []);
  });

  it("more wordy phrases are reported, and their short forms are not", () => {
    const wordy = "With the exception of Friday, we met online. The office is in the vicinity of the station. In an effort to save time, we stayed.\n";
    assert.deepEqual(findingsOf(RULE, wordy), [
      '"with the exception of" can be said in fewer words',
      '"in the vicinity of" can be said in fewer words',
      '"in an effort to" can be said in fewer words',
    ]);
    assert.deepEqual(findingsOf(RULE, "Except on Friday, we met online. The office is near the station. To save time, we stayed.\n", en, "strict"), []);
  });

  it("Japanese: two sentences with a wordy phrase are reported at normal, one is not", () => {
    const two = "資料は社内から閲覧することが可能です。現時点において、追加の予定はありません。\n";
    assert.deepEqual(findingsOf(RULE, two, ja), ["「することが可能」は、もっと短く言えます", "「現時点において」は、もっと短く言えます"]);
    assert.deepEqual(findingsOf(RULE, "資料は社内から閲覧することが可能です。\n", ja), []);
    assert.deepEqual(findingsOf(RULE, "今回の結果は成功であると言えます。\n", ja, "strict"), ["「であると言える」は、もっと短く言えます"]);
  });

  it("Japanese: the short forms, することができる and 必要性 are not reported", () => {
    const short = "資料は社内から閲覧できます。現在、追加の予定はありません。今回の結果は成功です。\n";
    assert.deepEqual(findingsOf(RULE, short, ja, "strict"), []);
    assert.deepEqual(findingsOf(RULE, "資料は社内から閲覧することができます。業務上の必要性があります。\n", ja, "strict"), []);
  });

  it("Japanese: every lexicon phrase is found in a sentence", () => {
    const lexicon = ja.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(RULE, `この件は${entry.pattern}。\n`, ja, "strict").length, 1, entry.pattern));
  });
});

describe("weasel-word", () => {
  const RULE = "weasel-word";

  it("a claim credited to no one is reported from the first", () => {
    assert.deepEqual(findingsOf(RULE, "Many experts say remote work raises output.\n"), ['"many experts say" does not say who']);
    assert.deepEqual(findingsOf(RULE, "It is widely believed that the old API is slower.\n"), ['"it is widely believed" does not say who']);
  });

  it("a named source is not", () => {
    assert.deepEqual(findingsOf(RULE, "Smith (2021) found that short meetings save time.\n"), []);
  });

  it("more unnamed sources are reported, and a named one is not", () => {
    assert.deepEqual(findingsOf(RULE, "Studies suggest that short meetings save time.\n"), ['"studies suggest" does not say who']);
    assert.deepEqual(findingsOf(RULE, "Some argue that the old API is slower.\n"), ['"some argue" does not say who']);
    assert.deepEqual(findingsOf(RULE, "The 2021 Smith study suggests that short meetings save time. Two reviewers argue that the old API is slower.\n"), []);
  });

  it("日本語で、出典の無い言い回しを言う（活用した形も）", () => {
    assert.deepEqual(findingsOf(RULE, "在宅勤務は生産性を上げると言われています。\n", ja), ["「と言われている」は、誰が言ったのかを言っていません"]);
    assert.deepEqual(findingsOf(RULE, "この寺は空海が建てたと言われていた。\n", ja), ["「と言われている」は、誰が言ったのかを言っていません"]);
    assert.deepEqual(findingsOf(RULE, "ある研究によると、短い会議は時間を節約します。\n", ja), ["「ある研究によると」は、誰が言ったのかを言っていません"]);
    assert.deepEqual(findingsOf(RULE, "多くの専門家が、この方式を勧めています。\n", ja), ["「多くの専門家が」は、誰が言ったのかを言っていません"]);
    assert.deepEqual(findingsOf(RULE, "多くの人が考えているほど、移行は難しくありません。\n", ja), ["「多くの人が考える」は、誰が言ったのかを言っていません"]);
  });

  it("日本語で、出典を名指す形と、言い伝えでない「言われる」「一般的に」は言わない", () => {
    const named = "厚生労働省の研究によると、短い会議は時間を節約します。山田（2021）は、在宅勤務で生産性が上がったと報告しています。\n";
    assert.deepEqual(findingsOf(RULE, named, ja), []);
    assert.deepEqual(findingsOf(RULE, "上司に「直せ」と言われると、別の方向に整えてしまう。\n", ja), []);
    assert.deepEqual(findingsOf(RULE, "外務省のロビーのようだったと言われるほど、多くの外国人が訪れた。\n", ja), []);
    assert.deepEqual(findingsOf(RULE, "この関数は、イベントリスナーとして一般的に使用されます。\n", ja), []);
    assert.deepEqual(findingsOf(RULE, "多くの人が会場に集まった。\n", ja), []);
    assert.deepEqual(findingsOf(RULE, "「急がば回れ」とよく言われるように、近道は遠回りになります。\n", ja), []);
  });
});

describe("homophone-slip", () => {
  const RULE = "homophone-slip";

  it("a pair the next word settles is reported", () => {
    assert.deepEqual(findingsOf(RULE, "The service restarts on it's own.\n"), ['"it\'s own" has one homophone typed for another']);
    assert.deepEqual(findingsOf(RULE, "Their are three open tickets.\n"), ['"their are" has one homophone typed for another']);
    assert.deepEqual(findingsOf(RULE, "We could of shipped sooner.\n"), ['"could of" has one homophone typed for another']);
  });

  it("the right forms, and pairs the next word does not settle, are not", () => {
    const right = "The service restarts on its own. There are three open tickets. It's time to ship. They're people we trust.\n";
    assert.deepEqual(findingsOf(RULE, right), []);
    assert.deepEqual(findingsOf(RULE, "Its antenna is bent. Their arena is full.\n"), []);
  });
});

describe("sentence-initial-so", () => {
  const RULE = "sentence-initial-so";

  it('"So," opening a sentence is reported', () => {
    assert.deepEqual(findingsOf(RULE, "The vendor was late. So, the launch slipped.\n"), ['1 sentence opens with "So," (1 needed)']);
  });

  it('"So far", "So that" and "so," inside a sentence are not', () => {
    assert.deepEqual(findingsOf(RULE, "So far the plan holds. So that it holds, we test it. We said so, twice.\n"), []);
  });
});

describe("doubled-nado", () => {
  const RULE = "doubled-nado";

  it("「など」と「等」を重ねた所を言う", () => {
    assert.deepEqual(findingsOf(RULE, "申請書等などを提出してください。\n", ja), ["「等など」は、「ほかにもある」を二度言っています"]);
    assert.deepEqual(findingsOf(RULE, "交通費、宿泊費など等は会社が負担します。\n", ja), ["「など等」は、「ほかにもある」を二度言っています"]);
  });

  it("片方だけ、「などなど」、語の一部の「等」は言わない", () => {
    assert.deepEqual(findingsOf(RULE, "申請書などを提出してください。書類等は返却しません。お菓子などなど。平等などの理念。\n", ja), []);
  });

  it('English: "and etc." and its kin are reported from the first', () => {
    assert.deepEqual(findingsOf(RULE, "Bring pens, paper and etc. to the workshop.\n"), ['"and etc." says "and so on" twice']);
    assert.deepEqual(findingsOf(RULE, "We bring pens, paper and etc.\n"), ['"and etc." says "and so on" twice']);
    assert.deepEqual(findingsOf(RULE, "We cover travel, meals, etc. and so on.\n"), ['"etc. and so on" says "and so on" twice']);
  });

  it("English: etc. alone, and so on alone, and a word ending in etc are not", () => {
    assert.deepEqual(findingsOf(RULE, "Bring pens, paper, etc. to the workshop. We cover travel, meals and so on. The fetch and etcd logs stay.\n"), []);
    assert.deepEqual(findingsOf(RULE, "Cars use the cash lanes and ETC lanes at the toll gate.\n"), []);
  });

  it("English: every lexicon phrase is found in a sentence", () => {
    const lexicon = en.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(RULE, `Bring pens, paper ${entry.pattern} to the room.\n`).length, 1, entry.pattern));
  });
});
