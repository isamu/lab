import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// email-stock-courtesy: one stock courtesy is politeness; two or more in one email is the stack a reader
// notices in a generated email. Self-written samples.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const findings = (source: string, genre = "business/email", adapter: LanguageAdapter = en) =>
  runRules(buildDocument("mail.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter(
    (finding) => finding.rule === "email-stock-courtesy",
  );

const generated = [
  "Hi Dana,",
  "",
  "I hope you're having a good week.",
  "",
  "Could we move Thursday's call to next week? If none of the times suit you, just let me know what works best.",
  "",
  "I apologize for any inconvenience this may cause, and I appreciate your flexibility.",
  "",
  "Best regards,",
  "Lee",
  "",
].join("\n");

describe("email-stock-courtesy", () => {
  it("reports every sentence of an email that stacks stock courtesies", () => {
    assert.deepEqual(
      findings(generated).map((finding) => finding.line),
      [3, 5, 7],
    );
  });

  it("counts a curly apostrophe and the British spelling", () => {
    const source = "I hope you’re having a great week.\n\nWe apologise for any inconvenience.\n";
    assert.equal(findings(source).length, 2);
  });

  it("leaves one courtesy alone", () => {
    assert.deepEqual(findings("Hi Dana,\n\nI hope this email finds you well. The invoice for October is attached; it is due on 14 November.\n"), []);
  });

  it("leaves a plain email alone", () => {
    const source = "Hi Dana,\n\nCould we move Thursday's call to Tuesday at 10? The draft needs two more days.\n\nLee\n";
    assert.deepEqual(findings(source), []);
  });

  it("does not count the phrases a human report also uses", () => {
    const source = "Reach out to the service desk if you have any questions. Staff can reach out to their manager first.\n";
    assert.deepEqual(findings(source), []);
  });

  it("does not run outside emails or on Japanese text", () => {
    assert.deepEqual(findings(generated, "blog/essay"), []);
    const handbook = "Please feel free to use this as a starting point. You should feel free to explore alternate strategies.\n";
    assert.deepEqual(findings(handbook, "business/report"), []);
    assert.deepEqual(findings("ご理解とご協力のほど、よろしくお願いいたします。ご不明な点はお気軽にお問い合わせください。\n", "business/email", ja), []);
  });
});
