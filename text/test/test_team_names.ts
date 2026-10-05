import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocument, type TeamRules } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { loadConfig } from "../packages/chaff/src/config/read.ts";
import { nameProblems } from "../packages/chaff/src/config/name-problems.ts";
import { nameSpans } from "../packages/chaff/src/team-names.ts";
import { runInit } from "../packages/chaff/src/init.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const teamWith = (names: readonly string[]): TeamRules => ({ jargon: [], requiredSections: [], names });

const findingsOf = (adapter: LanguageAdapter, source: string, rule: string, names: readonly string[] = [], limit?: number): Finding[] =>
  runRules(
    buildDocument("t.md", source, adapter, teamWith(names)),
    loadRules(adapter.id),
    { [rule]: "normal" },
    true,
    "business/report",
    limit === undefined ? {} : { [rule]: limit },
  ).findings.filter((finding) => finding.rule === rule);

const KANJI = "max-kanji-continuous";
/** The rule's own normal: business raises it by genre, and these read the detector, not the genre. */
const KANJI_NORMAL = loadRules("ja").find((rule) => rule.id === KANJI)?.levels.normal;
const kanjiWords = (source: string, names: readonly string[] = []): string[] =>
  findingsOf(ja, `# 報告\n\n${source}\n`, KANJI, names, KANJI_NORMAL).map((finding) => String(finding.values["word"]));

const tmpConfig = (body: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "chaff-names-")), "chaff.yaml");
  writeFileSync(path, body, "utf8");
  return path;
};

describe("nameSpans — 並べた名前が本文のどこにあるか", () => {
  it("すべての出現を返し、重なる名前は 1 つの範囲にまとめる", () => {
    assert.deepEqual(nameSpans("甲委員会と甲委員会", ["甲委員会"]), [
      { start: 0, end: 4 },
      { start: 5, end: 9 },
    ]);
    assert.deepEqual(nameSpans("個人情報保護委員会", ["個人情報保護委員会", "保護委員会"]), [{ start: 0, end: 9 }]);
  });

  it("接して並んだ 2 つの名前は 2 つのまま", () => {
    assert.deepEqual(nameSpans("甲委員会乙委員会", ["甲委員会", "乙委員会"]), [
      { start: 0, end: 4 },
      { start: 4, end: 8 },
    ]);
  });

  it("行を折り返した名前も当たる。改行は読み手には見えないか、空白 1 つ", () => {
    assert.deepEqual(nameSpans("met Bank\nof England", ["Bank of England"]), [{ start: 4, end: 19 }]);
    assert.deepEqual(nameSpans("個人情報\n保護委員会", ["個人情報保護委員会"]), [{ start: 0, end: 10 }]);
    assert.deepEqual(nameSpans("BankofEngland", ["Bank of England"]), []);
  });

  it("大文字と小文字を区別する。名前は書かれたとおりの綴り", () => {
    assert.deepEqual(nameSpans("apple and Apple", ["Apple"]), [{ start: 10, end: 15 }]);
  });

  it("名前が無い・空文字の名前は何も返さない", () => {
    assert.deepEqual(nameSpans("本文", []), []);
    assert.deepEqual(nameSpans("本文", [""]), []);
  });
});

describe("chaff.yaml の names", () => {
  it("並びを読む。空白だけの項目は落とし、数は文字として読む", () => {
    const config = loadConfig(tmpConfig("names:\n  - 個人情報保護委員会\n  - ' '\n  - 2025\n"));
    assert.deepEqual(config.names, ["個人情報保護委員会", "2025"]);
    assert.deepEqual(nameProblems(config), []);
  });

  it("書かなければ空で、何も言わない", () => {
    const config = loadConfig(tmpConfig("genre: business/report\n"));
    assert.deepEqual(config.names, []);
    assert.deepEqual(nameProblems(config), []);
  });

  it("並びでない値は読まず、読めない理由を両方の言語で言う", () => {
    const config = loadConfig(tmpConfig("names: 個人情報保護委員会\n"));
    assert.deepEqual(config.names, []);
    const [jaProblem] = nameProblems(config, "ja");
    const [enProblem] = nameProblems(config, "en");
    assert.match(jaProblem ?? "", /names/u);
    assert.match(jaProblem ?? "", /個人情報保護委員会/u);
    assert.match(jaProblem ?? "", /並べ/u);
    assert.match(enProblem ?? "", /names/u);
    assert.match(enProblem ?? "", /list/u);
  });

  it("並びの中の、名前でない項目だけを読めないと言う。ほかの名前は効く", () => {
    const config = loadConfig(tmpConfig("names:\n  - 国土交通省鉄道局総務課\n  - { a: b }\n  - null\n"));
    assert.deepEqual(config.names, ["国土交通省鉄道局総務課"]);
    assert.equal(nameProblems(config).length, 2);
  });

  it("chaff init のひな形は names の書き方を示すが、名前は 1 つも入れない", () => {
    ["ja", "en"].forEach((ui) => {
      const root = mkdtempSync(join(tmpdir(), "chaff-init-names-"));
      runInit(root, "business/report", ui === "en" ? "en" : "ja");
      const path = join(root, "chaff.yaml");
      assert.match(readFileSync(path, "utf8"), /^# names:/mu);
      assert.deepEqual(loadConfig(path).names, []);
    });
  });
});

describe("max-kanji-continuous と names", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("invalid: 並べていない正式名称は今までどおり指摘する", () => {
    assert.deepEqual(kanjiWords("個人情報保護委員会事務局に問い合わせる。"), ["個人情報保護委員会事務局"]);
    assert.deepEqual(kanjiWords("国土交通省鉄道局総務課に届ける。", ["個人情報保護委員会"]), ["国土交通省鉄道局総務課"]);
  });

  it("valid: 並べた名前は連なりの中で数えない", () => {
    assert.deepEqual(kanjiWords("関西館文献提供課複写貸出係に申し込む。", ["関西館文献提供課複写貸出係"]), []);
    assert.deepEqual(kanjiWords("国土交通省鉄道局総務課に届ける。", ["国土交通省鉄道局総務課"]), []);
    assert.deepEqual(kanjiWords("個人情報保護委員会事務局に問い合わせる。", ["個人情報保護委員会"]), []);
  });

  it("invalid: 名前の外に続く漢字は、それだけで長ければ指摘する", () => {
    assert.deepEqual(kanjiWords("個人情報保護委員会事務局総務課長補佐が答えた。", ["個人情報保護委員会"]), ["事務局総務課長補佐"]);
  });

  it("invalid: 名前の一部だけが本文にあっても、名前として扱わない", () => {
    assert.deepEqual(kanjiWords("個人情報保護委員事務局総務課に届ける。", ["個人情報保護委員会"]), ["個人情報保護委員事務局総務課"]);
  });
});

describe("max-kanji-continuous と鉤括弧でくくった名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 鉤括弧の中身がまるごと 1 つの漢字の連なりなら数えない", () => {
    assert.deepEqual(kanjiWords("「英国大使館別荘記念公園」を訪れた。"), []);
    assert.deepEqual(kanjiWords("『情報処理推進機構認定試験』を受けた。"), []);
  });

  it("invalid: 括弧が無ければ、同じ連なりを指摘する", () => {
    assert.deepEqual(kanjiWords("英国大使館別荘記念公園を訪れた。"), ["英国大使館別荘記念公園"]);
  });

  it("invalid: 括弧の中に漢字でない字もあれば、中の連なりは今までどおり数える", () => {
    assert.deepEqual(kanjiWords("「英国大使館別荘記念公園の庭」を訪れた。"), ["英国大使館別荘記念公園"]);
    assert.deepEqual(kanjiWords("「中禅寺湖畔の英国大使館別荘記念公園」を訪れた。"), ["英国大使館別荘記念公園"]);
  });

  it("invalid: 閉じない括弧は引用ではない", () => {
    assert.deepEqual(kanjiWords("「英国大使館別荘記念公園を訪れた。"), ["英国大使館別荘記念公園"]);
  });
});

/** 200 語の床を越えるための、繰り返しの無い語の並び。 */
const filler = (count: number): string =>
  Array.from({ length: count }, (_, index) => `Term${index * 7 + 3} covers topic${index * 11 + 5} alone${index}.`).join(" ");

describe("ngram-repetition と names", () => {
  const MINISTRY = "Ministry of Land, Infrastructure, Transport and Tourism";
  const signed = Array.from({ length: 7 }, (_, index) => `The ${MINISTRY} signed deal${index}.`).join(" ");
  const source = `# Report\n\n${signed} ${filler(60)}\n`;
  const ngram = (names: readonly string[] = []): Finding[] => findingsOf(en, source, "ngram-repetition", names);

  it("invalid: 並べていなければ、名前の繰り返しを言い回しと読む", () => {
    assert.equal(ngram().length, 1);
  });

  it("valid: 並べた名前にかかる語句は数えない", () => {
    assert.deepEqual(ngram([MINISTRY]), []);
  });

  it("invalid: 名前に触れない言い回しの繰り返しは今までどおり数える", () => {
    const repeated = Array.from({ length: 7 }, (_, index) => `In case ${index}, we will look into it again later.`).join(" ");
    const phrasing = `# Report\n\n${repeated} ${filler(60)}\n`;
    assert.equal(findingsOf(en, phrasing, "ngram-repetition", [MINISTRY]).length, 1);
  });
});

describe("undefined-acronym と names", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const acronyms = (source: string, names: readonly string[] = []): string[] =>
    findingsOf(en, `# Report\n\n${source}\n`, "undefined-acronym", names, 1).map((finding) => String(finding.values["word"]));

  it("invalid: 並べていない略語は今までどおり指摘する", () => {
    assert.deepEqual(acronyms("We met JAXA and NEDO last week."), ["JAXA", "NEDO"]);
  });

  it("valid: 並べた名前の略語は展開を求めない", () => {
    assert.deepEqual(acronyms("We met JAXA and NEDO last week.", ["JAXA"]), ["NEDO"]);
  });

  it("繋いだ略語は、どの片割れも並べてあれば求めない", () => {
    assert.deepEqual(acronyms("We met JAXA-ISAS and NEDO last week.", ["JAXA", "ISAS"]), ["NEDO"]);
    assert.deepEqual(acronyms("We met JAXA-ISAS and NEDO last week.", ["JAXA"]), ["JAXA-ISAS", "NEDO"]);
  });

  it("valid: 並べた名前の中に現れる略語も求めない", () => {
    assert.deepEqual(acronyms("We met NTT Docomo and NEDO last week.", ["NTT Docomo"]), ["NEDO"]);
    assert.deepEqual(acronyms("We met NTT\nDocomo and NEDO last week.", ["NTT Docomo"]), ["NEDO"]);
  });
});

describe("proper-noun-density と names", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const meetings = Array.from({ length: 20 }, (_, index) => `The Bank of England met the Federal Reserve Bank of New York on day ${index}.`).join(" ");
  const source = `# Report\n\n${meetings}\n`;
  const count = (names: readonly string[] = []): number => Number(findingsOf(en, source, "proper-noun-density", names, 1)[0]?.values["count"] ?? 0);

  it("並べた名前は、何語に割れても 1 つの固有名詞として数える", () => {
    assert.equal(count(["Bank of England", "Federal Reserve Bank of New York"]), 40);
  });

  it("行を折り返した名前も 1 つと数える", () => {
    const wrapped = source.replaceAll("Bank of England", "Bank\nof England");
    const counted = Number(findingsOf(en, wrapped, "proper-noun-density", ["Bank of England", "Federal Reserve Bank of New York"], 1)[0]?.values["count"] ?? 0);
    assert.equal(counted, 40);
  });

  it("並べていなければ、割れた語をそれぞれ数える", () => {
    assert.ok(count() > 40, `count ${count()}`);
  });
});
