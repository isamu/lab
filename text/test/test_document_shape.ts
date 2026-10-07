import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { echoPercent, headingLength, isParagraphHeading, leadParagraphOf, titleSectionOf } from "../packages/chaff/src/detectors/document-shape.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// no-lead and title-length: the top of a document. Every example is self-written.

const fired = (adapter: LanguageAdapter, source: string, rule: string, genre = "blog/tech"): number =>
  firedRules(adapter, source, genre).filter((id) => id === rule).length;

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("headingLength: characters in Japanese, words in English", () => {
  const cases: readonly (readonly [string, "char" | "word", number])[] = [
    ["在庫システム", "char", 6],
    ["在庫 システム", "char", 6],
    ["API の使い方", "char", 2 + 4],
    ["Generator の設計", "char", 2 + 3],
    ["`useSelector` の引数", "char", 2 + 3],
    ["2025年度の計画", "char", 2 + 5],
    ["", "char", 0],
    ["The new inventory system", "word", 4],
    ["The  new\tsystem", "word", 3],
    ["Q&A – what to do", "word", 4],
    ["**Bold** heading", "word", 2],
    ["", "word", 0],
  ];
  cases.forEach(([heading, unit, length]) => {
    it(`${JSON.stringify(heading)} is ${String(length)} ${unit === "char" ? "characters" : "words"}`, () => assert.equal(headingLength(heading, unit), length));
  });
});

describe("isParagraphHeading: a description pasted into a heading line", () => {
  const paragraphs = [
    "本メールは配信専用です。返信はできません。",
    "地理院地図はスマートフォンでも使えます。 操作の手順を説明します。",
    "We moved. The office is closed.",
    "The API is ready. Next, open it.",
    "It is done.) Then we left.",
  ];
  const headings = [
    "在庫システムの移行手順",
    "なぜ台風と呼ばないのですか？",
    "Q5. 国家公務員試験について",
    "What is a spacewalk?",
    "U.S. Department of Labor",
    "Chapter 12. Moving on",
    "第2章 総則。",
    "Version 2. Overview",
  ];
  paragraphs.forEach((text) => {
    it(`${JSON.stringify(text)} is a paragraph`, () => assert.equal(isParagraphHeading(text), true));
  });
  headings.forEach((text) => {
    it(`${JSON.stringify(text)} is a heading`, () => assert.equal(isParagraphHeading(text), false));
  });
});

describe("echoPercent: how much of the title the lead repeats", () => {
  it("is 100 when the lead holds the whole title", () =>
    assert.equal(echoPercent("新しい在庫システム", "この記事では、新しい在庫システムについて紹介します。"), 100));
  it("is 0 when the lead is about something else", () => assert.equal(echoPercent("新しい在庫システム", "2026年1月5日 お知らせ"), 0));
  it("folds case", () => assert.equal(echoPercent("The New Inventory System", "This article introduces the new inventory system."), 100));
  it("is 0 for a title too short to compare", () => assert.equal(echoPercent("概要", "概要を書きます。"), 0));
  it("is 0 for an empty lead", () => assert.equal(echoPercent("新しい在庫システム", ""), 0));
});

describe("leadParagraphOf: the paragraph right under the title", () => {
  const leadOf = (source: string): string | undefined => {
    const doc = buildDocument("t.md", source, ja);
    const title = titleSectionOf(doc);
    const lead = title === undefined ? undefined : leadParagraphOf(doc, title);
    return lead === undefined ? undefined : doc.source.slice(lead.span.start, lead.span.end).trim();
  };
  it("is the first paragraph", () => assert.equal(leadOf("# 題\n\n最初の段落です。\n\n次の段落です。\n"), "最初の段落です。"));
  it("is none when a list comes first", () => assert.equal(leadOf("# 題\n\n- 項目です。\n\n段落です。\n"), undefined));
  it("is none when a subheading comes first", () => assert.equal(leadOf("# 題\n\n## 節\n\n段落です。\n"), undefined));
  it("is none without a top-level heading", () => assert.equal(leadOf("## 節\n\n段落です。\n"), undefined));
  it("is none for a title with nothing under it", () => assert.equal(leadOf("# 題\n"), undefined));
});

describe("no-lead: a lead that only restates the title", () => {
  it("reports a Japanese lead that announces the title", () =>
    assert.equal(fired(ja, "# 新しい在庫システム\n\nこの記事では、新しい在庫システムについて紹介します。\n\n## 使い方\n\n画面を開きます。\n", "no-lead"), 1));

  it("reports an English lead that announces the title", () =>
    assert.equal(fired(en, "# The new inventory system\n\nThis article introduces the new inventory system.\n\n## Use\n\nOpen the screen.\n", "no-lead"), 1));

  it("says how many new words the lead adds", () => {
    const findings = runRules(
      buildDocument("a.md", "# 新しい在庫システム\n\nこの記事では、新しい在庫システムについて紹介します。\n", ja),
      loadRules("ja"),
      {},
      true,
      "blog/tech",
    ).findings.filter((finding) => finding.rule === "no-lead");
    assert.equal(findings[0]?.values["count"], 2);
    assert.equal(findings[0]?.line, 3);
  });

  it("does not report a lead that says something new", () =>
    assert.equal(fired(ja, "# 新しい在庫システム\n\n来月から全店の在庫を一つの画面で数えられるようになり、棚卸しは半日で終わります。\n", "no-lead"), 0));

  it("does not report a lead that repeats the title and then adds its point", () =>
    assert.equal(
      fired(
        en,
        "# The new inventory system\n\nThe new inventory system lets every store count its stock on one screen from March, and a stocktake takes half a day.\n",
        "no-lead",
      ),
      0,
    ));

  it("does not report a date or a byline under the title", () => {
    assert.equal(fired(ja, "# 新しい在庫システム\n\n2026年1月5日\n\n本文です。\n", "no-lead"), 0);
    assert.equal(fired(en, "# The new inventory system\n\nJane Smith\n\nThe body.\n", "no-lead"), 0);
  });

  it("does not run on a contract", () => assert.equal(fired(ja, "# 利用規約\n\nこの利用規約について定めます。\n", "no-lead", "legal/contract"), 0));
});

describe("title-length: a title or heading too long to scan", () => {
  const LONG_JA = "## 2025年度から始まる新しい在庫管理システムへの移行に伴う各店舗での作業手順と注意点について";
  const LONG_EN = "## What every store needs to do during the move to the new inventory system in the 2025 financial year";

  it("reports a long Japanese heading, on its own line", () => {
    const findings = runRules(
      buildDocument("a.md", `# 題\n\n本文です。\n\n${LONG_JA}\n\n本文です。\n`, ja),
      loadRules("ja"),
      {},
      true,
      "blog/tech",
    ).findings.filter((finding) => finding.rule === "title-length");
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 5);
    assert.equal(findings[0]?.column, 1);
    assert.equal(findings[0]?.variant, undefined);
  });

  it("reports a long English heading", () => assert.equal(fired(en, `# Title\n\nText.\n\n${LONG_EN}\n\nText.\n`, "title-length"), 1));

  it("names a long first top-level heading the title", () => {
    const findings = runRules(buildDocument("a.md", `${LONG_JA.slice(1)}\n\n本文です。\n`, ja), loadRules("ja"), {}, true, "blog/tech").findings.filter(
      (finding) => finding.rule === "title-length",
    );
    assert.equal(findings[0]?.variant, "title");
  });

  it("does not report a paragraph read as a heading above a rule", () =>
    assert.equal(
      fired(
        ja,
        "# 題\n\n本文です。\n\n本メールは、電子申告に登録いただいた方へ、毎月の初めに配信しております。なお、このアドレスは送信専用です。\n----------\n\n本文です。\n",
        "title-length",
      ),
      0,
    ));

  it("does not report a title line that carries a pasted description", () =>
    assert.equal(
      fired(
        ja,
        "# 地理院地図をスマートフォンで使う 地理院地図はスマートフォンでも利用できます。 利用する際の操作手順を説明します。\n\n本文です。\n",
        "title-length",
      ),
      0,
    ));

  it("points at the heading text of an underlined heading, not the underline", () => {
    const findings = runRules(
      buildDocument("a.md", `# 題\n\n本文です。\n\n${LONG_EN.slice(3)}\n---\n\nText.\n`, en),
      loadRules("en"),
      {},
      true,
      "blog/tech",
    ).findings.filter((finding) => finding.rule === "title-length");
    assert.equal(findings[0]?.line, 5);
  });

  it("says it did not run on plain text", () => {
    const result = runRules(buildDocument("a.txt", `${LONG_JA.slice(3)}\n\n本文です。\n`, ja), loadRules("ja"), {}, true, "blog/tech");
    assert.equal(result.findings.filter((finding) => finding.rule === "title-length").length, 0);
    assert.ok(result.skipped.some((entry) => entry.rule === "title-length"));
  });

  it("does not report a heading that asks a question", () => {
    assert.equal(fired(en, `# Title\n\nText.\n\n${LONG_EN}?\n\nText.\n`, "title-length"), 0);
    assert.equal(fired(ja, `# 題\n\n本文です。\n\n${LONG_JA}知っておくべきことは何ですか？\n\n本文です。\n`, "title-length"), 0);
    assert.equal(fired(en, `# Title\n\nText.\n\n${LONG_EN} ("what changes?")\n\nText.\n`, "title-length"), 0);
    assert.equal(fired(en, `# Title\n\nText.\n\n${LONG_EN} (why?) and how\n\nText.\n`, "title-length"), 1);
  });

  it("does not report a short heading", () => assert.equal(fired(ja, "# 在庫システム\n\n## 移行の手順\n\n本文です。\n", "title-length"), 0));

  it("does not count a number label at the head", () =>
    assert.equal(fired(en, "# Title\n\n## Chapter 12. Moving to the new inventory system this year\n\nText.\n", "title-length"), 0));

  it("allows a longer formal title in a report", () => {
    const formal = "# 令和8年度における新しい在庫管理システムへの移行に伴う全国の各店舗での具体的な作業について\n\n本文です。\n";
    assert.equal(fired(ja, formal, "title-length", "blog/tech"), 1);
    assert.equal(fired(ja, formal, "title-length", "business/report"), 0);
  });

  it("does not run in an FAQ, whose headings are questions", () =>
    assert.equal(fired(ja, `# よくある質問\n\n${LONG_JA}\n\n答えです。\n`, "title-length", "docs/faq"), 0));
});
