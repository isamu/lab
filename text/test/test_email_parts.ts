import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailParts, emailVocabulary } from "../packages/chaff/src/email-parts.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter, Span } from "../packages/chaff/src/plugin.ts";

// Plain-text and Markdown email: the header, the separator lines, the signature and the quoted reply are not the
// writer's prose. Every email here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const lines = (...rows: string[]): string => rows.join("\n");

const textsOf = (source: string, spans: readonly Span[]): string[] => spans.map((span) => source.slice(span.start, span.end));

const partsOf = (source: string, adapter: LanguageAdapter = en): { furniture: string[]; replyQuotes: string[] } => {
  const parts = emailParts(source, emailVocabulary(adapter.lexicons));
  return { furniture: textsOf(source, parts.furniture), replyQuotes: textsOf(source, parts.replyQuotes) };
};

const HEADER_EN = lines(
  "From: Ann Lee <ann@example.com>",
  "To: Bob Kim <bob@example.com>",
  "Date: Mon, 5 Oct 2026 09:12:00 +0900",
  "Subject: The room booking pilot,",
  " second round",
);

describe("emailParts: headers", () => {
  it("a block of known Field: value lines is a header: other fields go whole, a written field (To, Subject) only its label", () => {
    const source = lines(HEADER_EN, "", "Hi Bob,", "", "The pilot starts next week.");
    assert.deepEqual(partsOf(source).furniture, ["From: Ann Lee <ann@example.com>", "To: ", "Date: Mon, 5 Oct 2026 09:12:00 +0900", "Subject: "]);
  });

  it("a folded line goes with its field", () => {
    const header = lines("Message-ID: <a1@example.com>", "References: <a0@example.com>", " <a00@example.com>");
    assert.deepEqual(partsOf(lines(header, "", "Text.")).furniture, ["Message-ID: <a1@example.com>", "References: <a0@example.com>\n <a00@example.com>"]);
  });

  it("an archive's envelope line (From and a date, no colon) opens the header", () => {
    const header = lines("From ann at example.com  Mon Oct  5 09:12:00 2026", "From: ann at example.com (Ann Lee)", "Subject: Pilot");
    assert.deepEqual(partsOf(lines(header, "", "Text.")).furniture, [
      "From ann at example.com  Mon Oct  5 09:12:00 2026",
      "From: ann at example.com (Ann Lee)",
      "Subject: ",
    ]);
  });

  it("Japanese field names, with a full-width colon", () => {
    const header = lines("件名：会議室の予約について", "差出人：山田太郎 <taro@example.com>", "宛先：佐藤花子 <hanako@example.com>");
    assert.deepEqual(partsOf(lines(header, "", "佐藤様", "", "お世話になっております。"), ja).furniture, [
      "件名：",
      "差出人：山田太郎 <taro@example.com>",
      "宛先：",
    ]);
  });

  it("one known field is a header only at the top of the message", () => {
    assert.deepEqual(partsOf(lines("Subject: Pilot", "", "Hi Bob.")).furniture, ["Subject: "]);
    assert.deepEqual(partsOf(lines("Hi Bob.", "", "Date: the first Monday of the month.")).furniture, []);
    assert.deepEqual(partsOf(lines("Summary: the API migration", "Date: June 2026", "", "This explains it.")).furniture, []);
  });

  it("a block with a line that is not a field, or with no known field, is prose", () => {
    assert.deepEqual(partsOf(lines("Hi Bob.", "", "Note: the pilot is free.", "It runs for a month.")).furniture, []);
    assert.deepEqual(partsOf(lines("Hi Bob.", "", "Scope: two rooms", "Length: one month")).furniture, []);
    assert.deepEqual(partsOf(lines("Hi Bob.", "", "https://example.com/a", "https://example.com/b")).furniture, []);
  });
});

describe("emailParts: separators and signatures", () => {
  it("an Outlook separator and the header after it", () => {
    const source = lines(
      "Thanks, I will book it.",
      "",
      "-----Original Message-----",
      "From: Bob Kim",
      "Sent: Monday, October 5, 2026 10:00",
      "To: Ann Lee",
      "Subject: Pilot",
      "",
      "Can you book the room?",
    );
    assert.deepEqual(partsOf(source).furniture, ["-----Original Message-----", "From: Bob Kim", "Sent: Monday, October 5, 2026 10:00", "To: ", "Subject: "]);
  });

  it("a line of underscores, and a forwarded-message line, are separators", () => {
    assert.deepEqual(partsOf(lines("Text.", "________________________________", "Subject: Pilot", "Date: today")).furniture, [
      "________________________________",
      "Subject: ",
      "Date: today",
    ]);
    assert.deepEqual(partsOf(lines("Text.", "", "---------- Forwarded message ---------", "From: Bob")).furniture, [
      "---------- Forwarded message ---------",
      "From: Bob",
    ]);
  });

  it("a signature runs from the '-- ' line to the next message, and at most a few lines", () => {
    const source = lines("See you then.", "", "-- ", "", "Ann Lee", "Sales team", "", "From: bob at example.com (Bob Kim)", "Subject: Re: Pilot");
    assert.deepEqual(partsOf(source).furniture, ["-- \n\nAnn Lee\nSales team", "From: bob at example.com (Bob Kim)", "Subject: "]);
    const long = lines("Text.", "--", "Line one", "Line two", "Line three", "Line four", "Line five is prose again.");
    assert.deepEqual(partsOf(long).furniture, ["--\nLine one\nLine two\nLine three\nLine four"]);
  });

  it("two rules with only spaces between them are a drawing, not a separator", () => {
    assert.deepEqual(partsOf(lines("   Corp 1          Corp 2", "   --------        --------", "   Server")).furniture, []);
  });

  it("a dash inside a sentence, or a Markdown rule, is not a signature", () => {
    assert.deepEqual(partsOf(lines("Text -- more text.", "", "Next.")).furniture, []);
  });
});

describe("emailParts: quoted replies", () => {
  it("an attribution line and the > lines after it, nested ones too", () => {
    const quote = lines("On Mon, Oct 5, 2026 at 9:12 AM, Ann Lee <ann@example.com> wrote:", "> Can we start on Monday?", ">", ">> Is the room free?");
    const source = lines("Yes, Monday works.", "", quote, "", "Bob");
    const parts = partsOf(source);
    assert.deepEqual(parts.replyQuotes, [quote]);
    assert.deepEqual(parts.furniture, ["On Mon, Oct 5, 2026 at 9:12 AM, Ann Lee <ann@example.com> wrote:"]);
  });

  it("an attribution wrapped onto two lines, and a blank line before the quote", () => {
    const quote = lines("On Mon, Oct 5, 2026 at 9:12 AM, Ann Lee", "<ann at example.com> wrote:", "", "> Can we start on Monday?");
    assert.deepEqual(partsOf(lines(quote, "", "Yes.")).replyQuotes, [quote]);
  });

  it("Japanese attributions: Gmail's date and address, and 「さんは書きました」", () => {
    const gmail = lines("2026年10月5日(月) 9:12 山田太郎 <taro@example.com>:", "> 月曜日から始められますか。");
    assert.deepEqual(partsOf(lines("はい、大丈夫です。", "", gmail), ja).replyQuotes, [gmail]);
    const thunderbird = lines("山田太郎 さんは書きました:", "> 月曜日から始められますか。");
    assert.deepEqual(partsOf(lines("はい。", "", thunderbird), ja).replyQuotes, [thunderbird]);
  });

  it("a blockquote the writer introduces is not a reply", () => {
    const source = lines("As the guide puts it:", "> Book the room a week ahead.", "", "We agree.");
    assert.deepEqual(partsOf(source), { furniture: [], replyQuotes: [] });
    assert.deepEqual(partsOf(lines("> Book the room a week ahead.", "", "We agree.")), { furniture: [], replyQuotes: [] });
    assert.deepEqual(partsOf(lines('See <a href="/guide">the guide</a>:', "> Book the room a week ahead.")).replyQuotes, []);
    assert.deepEqual(partsOf(lines("The team rewrote:", "> Book the room a week ahead.")).replyQuotes, []);
    assert.deepEqual(partsOf(lines("Note:", "> Book the room a week ahead.")).replyQuotes, []);
  });

  it("a long paragraph that ends with 'wrote:' is prose, not an attribution", () => {
    const source = lines(
      "Ann asked about the rooms.",
      "She listed the four she needs.",
      "She said which ones are free.",
      "And then she wrote:",
      "> Rooms A and B.",
    );
    assert.deepEqual(partsOf(source).replyQuotes, []);
  });
});

const findingsOf = (path: string, source: string, adapter: LanguageAdapter, genre: string) =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, genre);

const sentenceTexts = (path: string, source: string, adapter: LanguageAdapter): string =>
  buildDocument(path, source, adapter)
    .sentences.map((sentence) => sentence.text.trim())
    .join(" | ");

const REPLY_EN = lines(
  "From: Bob Kim <bob@example.com>",
  "To: Ann Lee <ann@example.com>",
  "Date: Tue, 6 Oct 2026 10:00:00 +0900",
  "Subject: Re: The room booking pilot",
  "",
  "Hi Ann,",
  "",
  "Monday works for us. We will have the floor plan ready.",
  "",
  "On Mon, Oct 5, 2026 at 9:12 AM, Ann Lee <ann@example.com> wrote:",
  "> Can we start the pilot on Monday, and could your facilities manager, who knows the building better than anyone, join us for the second half of the visit?",
  ">",
  "> ## Rooms",
  ">",
  "> Rooms A and B.",
  "",
  "-- ",
  "Bob Kim",
  "Facilities",
);

describe("an email reply, as text and as Markdown", () => {
  ["reply.txt", "reply.md"].forEach((path) => {
    it(`${path}: the header, attribution and signature are not sentences; the subject and the writer's text are`, () => {
      const text = sentenceTexts(path, REPLY_EN, en);
      assert.doesNotMatch(text, /Subject|bob@example\.com|wrote:|Facilities|Bob Kim|\+0900/u);
      assert.match(text, /(?:^| \| )Re: The room booking pilot \| /u);
      assert.match(text, /Monday works for us\./u);
    });

    it(`${path}: a heading inside the quoted reply is not a section of this email`, () => {
      assert.deepEqual(
        buildDocument(path, REPLY_EN, en).sections.map((section) => section.heading),
        [""],
      );
    });

    it(`${path}: no finding lands on the header, the quote or the signature`, () => {
      const findings = findingsOf(path, REPLY_EN, en, "business/email").findings;
      assert.deepEqual(
        findings.filter((finding) => finding.line <= 4 || finding.line >= 10),
        [],
      );
    });
  });

  it("bold in the signature is not emphasis in the body", () => {
    const source = lines("Monday works for us.", "", "-- ", "**Bob Kim**", "Facilities");
    assert.deepEqual(
      buildDocument("reply.md", source, en).sections.map((section) => section.strongCount),
      [0],
    );
  });

  it("the writer's own blockquote keeps its heading as a section", () => {
    const source = lines("Here are the notes you asked for:", "", "> ## Rooms", ">", "> Rooms A and B.");
    assert.deepEqual(
      buildDocument("notes.md", source, en).sections.map((section) => section.heading),
      ["", "Rooms"],
    );
  });
});

describe("a subject is the writer's words", () => {
  it("a doubled word in the subject is still found, on its line", () => {
    const source = lines("Subject: Meeting about the the room booking service", "", "Dear team,", "", "Thank you for asking.");
    assert.deepEqual(
      findingsOf("email.md", source, en, "business/email")
        .findings.filter((finding) => finding.rule === "doubled-word")
        .map((finding) => finding.line),
      [1],
    );
  });
});

describe("structure rules do not read a quoted reply", () => {
  const defineTwice = (quoteIntro: string): string =>
    lines('"Pilot" means the trial of the booking panels.', "", "Section 1 Scope", "", quoteIntro, '> "Pilot" means the paid trial.');

  ["reply.txt", "reply.md"].forEach((path) => {
    it(`${path}: a definition repeated in the quoted reply is not a second definition`, () => {
      const found = findingsOf(path, defineTwice("On Mon, Oct 5, 2026, Ann Lee <ann@example.com> wrote:"), en, "legal/contract").findings;
      assert.deepEqual(
        found.filter((finding) => finding.rule === "duplicate-definition"),
        [],
      );
    });
  });

  it("a definition repeated in the writer's own blockquote is still reported", () => {
    const found = findingsOf("notes.txt", defineTwice("Section 2 Terms"), en, "legal/contract").findings;
    assert.deepEqual(
      found.filter((finding) => finding.rule === "duplicate-definition").map((finding) => finding.line),
      [6],
    );
  });
});

const REPLY_JA = lines(
  "件名: Re: 会議室の予約サービスについて",
  "差出人: 佐藤一郎 <ichiro@example.com>",
  "宛先: 山田花子 <hanako@example.com>",
  "",
  "山田様",
  "",
  "月曜日で問題ありません。当日は案内図を用意しておきます。",
  "",
  "2026年10月5日(月) 9:12 山田花子 <hanako@example.com>:",
  "> 月曜日から始めたいのですが、施設の担当者の方にも、建物のことをいちばんよくご存じなので、後半の打ち合わせに同席していただくことはできますでしょうか。",
  "",
  "-- ",
  "佐藤一郎",
  "営業部",
);

describe("a Japanese email reply", () => {
  it("the header, attribution and signature are not sentences; the writer's text is", () => {
    const text = sentenceTexts("reply.txt", REPLY_JA, ja);
    assert.doesNotMatch(text, /件名|差出人|ichiro@example\.com|営業部/u);
    assert.match(text, /Re: 会議室の予約サービスについて/u);
    assert.match(text, /月曜日で問題ありません。/u);
  });

  it("no finding lands on the header, the quote or the signature", () => {
    const findings = findingsOf("reply.txt", REPLY_JA, ja, "business/email").findings;
    assert.deepEqual(
      findings.filter((finding) => finding.line <= 3 || finding.line >= 9),
      [],
    );
  });
});

describe("preamble-length on a document with no headings", () => {
  const PARAGRAPHS = lines("First paragraph.", "", "Second paragraph.", "", "Third paragraph.", "", "Fourth paragraph.");

  it("does not run, and says why", () => {
    const result = findingsOf("note.md", PARAGRAPHS, en, "business/report");
    assert.deepEqual(
      result.findings.filter((finding) => finding.rule === "preamble-length"),
      [],
    );
    assert.deepEqual(
      result.skipped.filter((skipped) => skipped.rule === "preamble-length").map((skipped) => skipped.why),
      ["the document has no headings below its title"],
    );
  });

  it("a title alone is not a heading to reach; the Japanese reason is in Japanese", () => {
    const result = findingsOf("note.md", lines("# 表題", "", "一段落目です。", "", "二段落目です。", "", "三段落目です。"), ja, "business/report");
    assert.deepEqual(
      result.skipped.filter((skipped) => skipped.rule === "preamble-length").map((skipped) => skipped.why),
      ["表題より下の見出しが無いため"],
    );
  });

  it("with a heading, it runs and counts the paragraphs before it", () => {
    const result = findingsOf("note.md", lines(PARAGRAPHS, "", "## Body", "", "Text."), en, "business/report");
    assert.deepEqual(
      result.findings.filter((finding) => finding.rule === "preamble-length").map((finding) => finding.values["count"]),
      [4],
    );
    assert.deepEqual(
      result.skipped.filter((skipped) => skipped.rule === "preamble-length"),
      [],
    );
  });
});
