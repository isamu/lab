import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { chatLogSpans } from "../packages/chaff/src/detectors/chat-log-line.ts";
import { capitalJoinedNameSpans } from "../packages/chaff/src/detectors/letter-joined-name.ts";
import { spelledBeforeSameNoun } from "../packages/chaff/src/detectors/acronym-gloss.ts";

// undefined-acronym and capitals that are not an acronym to spell out, or that the text explains without brackets: a keyword
// to text, an everyday word, a file format, a product's edition, a word inside a site's name, a pasted chat line, a name in
// lower case before the same noun, and a bracketed expansion with a word after the acronym. The excerpts follow US federal
// and Japanese government pages (public domain); the rest is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const enDoc = (body: string): string => `# Notice\n\n${body}\n`;
const jaDoc = (body: string): string => `# お知らせ\n\n${body}\n`;

describe("undefined-acronym: a name in lower case before the same noun", () => {
  it("reads IR as explained when the sentence writes incident response plan before IR plans", () => {
    const text = "- Have an incident response plan and use it: Organizations should regularly exercise IR plans for common threat scenarios.";
    assert.deepEqual(reportedAcronyms(en, enDoc(text)), []);
  });

  it("still reports the acronym before another noun, in another sentence, or with other initials", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("Have an incident response plan. Then exercise IR plans every year.")), ["IR"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("Have an incident response plan and train the IR team.")), ["IR"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("Have an internal review plan and use IR plans.")), []);
    assert.deepEqual(reportedAcronyms(en, enDoc("Have an incident plan and use IR plans.")), ["IR"]);
  });

  it("takes only the acronym's first use, and lower-case words only", () => {
    assert.deepEqual([...spelledBeforeSameNoun(["Use IR plans.", "An incident response plan and IR plans."])], []);
    assert.deepEqual([...spelledBeforeSameNoun(["An Incident Response plan and IR plans."])], []);
    assert.deepEqual([...spelledBeforeSameNoun(["an incident response plan and IR plans"])], ["IR"]);
    assert.deepEqual([...spelledBeforeSameNoun([])], []);
  });
});

describe("undefined-acronym: a bracketed expansion with a word after the acronym", () => {
  const release = (bracket: string): string =>
    enDoc(
      [
        "- The selected organizations will lead RAMPS projects.",
        "",
        `They will lead Regional Alliances and Multistakeholder Partnerships to Stimulate Cybersecurity Education and Workforce Development ${bracket} initiatives.`,
      ].join("\n"),
    );

  it("reads (RAMPS program) after a name whose head spells RAMPS as the expansion, for the earlier summary use too", () => {
    assert.deepEqual(reportedAcronyms(en, release("(RAMPS program)")), []);
  });

  it("still reports a bracket whose letters the name does not give, or a two-letter one", () => {
    assert.deepEqual(reportedAcronyms(en, release("(RMPQ program)")), ["RAMPS", "RMPQ"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("Workforce Development Partners (WD program) lead.")), ["WD"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("They met (RAMPS program staff and others) today.")), ["RAMPS"]);
  });
});

describe("undefined-acronym: a keyword to text", () => {
  it("does not report the keyword between a texting verb and a short code", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("It is as easy as texting GNPCGS to 333111 to sign up!")), []);
    assert.deepEqual(reportedAcronyms(en, enDoc('Text "PARKS" to 55555 for updates.')), []);
  });

  it("still reports capitals without the verb, or before a number that is not a short code", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("We expect GNPCGS to 333111 visitors.")), ["GNPCGS"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("Text GNPCGS to 12 people.")), ["GNPCGS"]);
  });
});

describe("undefined-acronym: everyday words and file formats", () => {
  it("does not report BB guns or an Office file format", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("Weapons (including BB, Pellet and Paint Guns) are illegal to possess.")), []);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("- 見積書(PDF形式, 120KB)\n- 物品供給見積書(DOCX形式, 44.27KB)\n- 内訳(XLSX形式, 20KB)")), []);
  });

  it("still reports an acronym that is not one of them", () => {
    assert.deepEqual(reportedAcronyms(ja, jaDoc("物品供給見積書(PSLPG形式, 44.27KB)")), ["PSLPG"]);
  });
});

describe("undefined-acronym: a product's edition", () => {
  it("does not report DC inside Acrobat Reader DC, in Japanese or English", () => {
    assert.deepEqual(reportedAcronyms(ja, jaDoc("Adobe Acrobat Reader DCのダウンロード（無償）")), []);
    assert.deepEqual(reportedAcronyms(en, enDoc("Download Adobe Acrobat Reader DC to read the form.")), []);
  });

  it("still reports DC on its own", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("The DC office opens at nine.")), ["DC"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("Reader DCを使います。")), ["DC"]);
  });
});

describe("undefined-acronym: capitals joined to a capitalised word", () => {
  it("does not report SAFE in the site name NITE SAFE-Lite", () => {
    const text = "独立行政法人製品安全評価技術基盤機構(NITE)の検索サイトである「NITE SAFE-Lite」で確認できます。";
    assert.deepEqual(reportedAcronyms(ja, jaDoc(text)), []);
  });

  it("covers the name only, not a title-case heading's word, a lower-case join or two acronyms", () => {
    const covers = (text: string, word: string): boolean =>
      capitalJoinedNameSpans(text).some((span) => span.start <= text.indexOf(word) && text.indexOf(word) + word.length <= span.end);
    assert.equal(covers("「NITE SAFE-Lite」で", "SAFE"), true);
    assert.equal(covers("Check SAFE-Lite.", "SAFE"), true);
    assert.equal(covers("NASA-Funded Research", "NASA"), false);
    assert.equal(covers("an API-driven tool", "API"), false);
    assert.equal(covers("RT-PCR tests", "RT"), false);
    assert.equal(covers("SAFE-Lite-2", "SAFE"), false);
    assert.deepEqual(capitalJoinedNameSpans(""), []);
  });
});

describe("undefined-acronym: a pasted chat log", () => {
  const report = (alert: string): string => enDoc(["SAL log", "", "All times in UTC.", "", "Automated alerting fired at 21:00:", "", alert].join("\n"));

  it("does not report an acronym in a bot's pasted message, but counts it towards the limit", () => {
    const alert = "<jinxer-wm> FIRING: PHPFPMTooBusy: Not enough idle PHP-FPM workers at eqiad";
    assert.deepEqual(reportedAcronyms(en, report(alert)), ["SAL"]);
  });

  it("covers a nick's line, after a list mark or a time, and not prose or an HTML tag with attributes", () => {
    const covered = (source: string, word: string): boolean =>
      chatLogSpans(source).some((span) => span.start <= source.indexOf(word) && source.indexOf(word) < span.end);
    assert.equal(covered("<jinxer-wm> FIRING: PHP-FPM busy", "PHP"), true);
    assert.equal(covered("- [21:04] <Amir1> the SRE is here", "SRE"), true);
    assert.equal(covered("The SRE pasted <jinxer-wm> output.", "SRE"), false);
    assert.equal(covered('<a href="x"> SRE</a>', "SRE"), false);
    assert.equal(covered("<jinxer-wm>", "jinxer"), false);
    assert.deepEqual(chatLogSpans(""), []);
  });

  it("still reports the writer's own acronym after the pasted line", () => {
    assert.deepEqual(reportedAcronyms(en, report("<jinxer-wm> FIRING: PHP-FPM busy\n\nThe SRE then restarted it.")), ["SAL", "SRE"]);
  });
});
