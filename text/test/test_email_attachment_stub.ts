import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailParts, emailVocabulary } from "../packages/chaff/src/email-parts.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A mailing-list archive's note in place of a removed attachment (Mailman's Scrubber) is list furniture, not the
// writer's prose. The phrasing is Mailman 2.1's, in English and in its Japanese catalogue; every message is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const lines = (...rows: string[]): string => rows.join("\n");

const furnitureOf = (source: string, adapter: LanguageAdapter = en): string[] =>
  emailParts(source, emailVocabulary(adapter.lexicons)).furniture.map((span) => source.slice(span.start, span.end));

const NEXT_PART = "-------------- next part --------------";
const URL_LINE = "URL: <http://lists.example.org/pipermail/team/attachments/20261005/0a1b2c3d/attachment.html>";

const message = (...stub: string[]): string => lines("Thanks, the room is booked.", "", "Ann", NEXT_PART, ...stub, "", "From: Bob Kim", "Subject: Re: Pilot");

describe("emailParts: an attachment stub after a separator", () => {
  it("Mailman's HTML stub: its note and its URL line", () => {
    const stub = lines("An HTML attachment was scrubbed...", URL_LINE);
    assert.deepEqual(furnitureOf(message(stub)), [NEXT_PART, stub, "From: Bob Kim", "Subject: "]);
  });

  it("Mailman's non-text stub, with its Name, Type, Size and Desc fields", () => {
    const stub = lines(
      "A non-text attachment was scrubbed...",
      "Name: signature.asc",
      "Type: application/pgp-signature",
      "Size: 819 bytes",
      "Desc: Digital signature",
      "URL: <http://lists.example.org/pipermail/team/attachments/20261005/0a1b2c3d/attachment.sig>",
    );
    assert.deepEqual(furnitureOf(message(stub)), [NEXT_PART, stub, "From: Bob Kim", "Subject: "]);
  });

  it("the Japanese catalogue's stub, with aligned field values", () => {
    const stub = lines(
      "テキスト形式以外の添付ファイルを保管しました...",
      "ファイル名: signature.asc",
      "型:         application/pgp-signature",
      "URL:        http://lists.example.jp/a/attachment.sig",
    );
    const source = lines("よろしくお願いします。", NEXT_PART, stub);
    assert.deepEqual(furnitureOf(source, ja), [NEXT_PART, stub]);
  });

  it("the English stub in a Japanese list archive", () => {
    const stub = lines("An HTML attachment was scrubbed...", URL_LINE);
    assert.deepEqual(furnitureOf(lines("よろしくお願いします。", NEXT_PART, stub), ja), [NEXT_PART, stub]);
  });

  it("the stub is not a sentence of the message", () => {
    const text = buildDocument("list.txt", message("An HTML attachment was scrubbed...", URL_LINE), en)
      .sentences.map((sentence) => sentence.text)
      .join(" | ");
    assert.doesNotMatch(text, /scrubbed|attachment\.html/u);
    assert.match(text, /the room is booked/u);
  });
});

describe("emailParts: text that only looks like an attachment stub", () => {
  it("a paragraph of the writer's after a separator, ending in a URL field, is prose", () => {
    assert.deepEqual(furnitureOf(message("Please see the booking page below.", "URL: <http://example.com/rooms>")), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });

  it("the note without a URL line is prose", () => {
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...", "Name: page.html")), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });

  it("the note with a line of prose after it is prose", () => {
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...", URL_LINE, "I will resend it as text.")), [
      NEXT_PART,
      "From: Bob Kim",
      "Subject: ",
    ]);
  });

  it("the note in the middle of a message, away from a separator, is the writer's", () => {
    const source = lines("Hi Bob,", "", "An HTML attachment was scrubbed...", URL_LINE, "", "Ann");
    assert.deepEqual(furnitureOf(source), []);
  });

  it("a line of prose between the note and the URL line is prose", () => {
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...", "I will resend it as text.", URL_LINE)), [
      NEXT_PART,
      "From: Bob Kim",
      "Subject: ",
    ]);
  });

  it("a first line that does not end as an archive's note is the writer's", () => {
    assert.deepEqual(furnitureOf(message("The old page was moved here:", URL_LINE)), [NEXT_PART, "From: Bob Kim", "Subject: "]);
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed... so I resent it:", URL_LINE)), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });

  it("the note alone, with no fields, is prose", () => {
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...")), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });

  it("a URL field with words after the URL, or not last, is not the stub's", () => {
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...", "URL: <http://example.com/a> is the old copy")), [
      NEXT_PART,
      "From: Bob Kim",
      "Subject: ",
    ]);
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...", URL_LINE, "Name: page.html")), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });

  it("more field lines than any archive writes is not a stub", () => {
    const fields = ["Name: a", "Type: b", "Size: c", "Desc: d", "Note: e"];
    assert.deepEqual(furnitureOf(message("An HTML attachment was scrubbed...", ...fields, URL_LINE)), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });

  it("a sentence that mentions a scrubbed attachment is prose", () => {
    assert.deepEqual(furnitureOf(message("I think your attachment was scrubbed...", "so here it is again.")), [NEXT_PART, "From: Bob Kim", "Subject: "]);
  });
});
