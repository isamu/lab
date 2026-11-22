import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { entriesForGenre } from "../packages/chaff/src/lexicon-genres.ts";
import { vagueWordsIn } from "../packages/chaff/src/detectors/vague-density.ts";
import { specifiedByBracket } from "../packages/chaff/src/detectors/bracket-specified.ts";
import { governedByLaw, lawReferenceOf, NO_LAW_REFERENCE } from "../packages/chaff/src/detectors/law-governed.ts";

// あいまいな語の密度（vague-word-density）。例文はすべて自作。

const RULE = "vague-word-density";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", genre).findings;

const PLAIN_JA = "会議は毎週月曜の十時に始まり、議題は前の週の金曜までに共有します。";
const PLAIN_EN = "The meeting starts at ten every Monday, and the agenda goes out by the Friday before. ";

describe("vague-word-density: あいまいな語が文書の長さに対して多い所", () => {
  it("重なれば、語のある文ごとに一度指す", () => {
    const source = `${PLAIN_JA.repeat(15)}障害は適宜報告し、必要に応じて連絡します。記録は適切に残し、なるべく早めにまとめます。\n`;
    const findings = findingsOf(source);
    assert.equal(findings.length, 2, findings.join("\n"));
    assert.match(findings[0] ?? "", /^「適宜」など、あいまいな語が 1000 字あたり \d+ 個あります（2 個まで）$/u);
  });

  it("英語の文書は英語で言う", () => {
    const source = `${PLAIN_EN.repeat(13)}Report incidents as needed and notify the appropriate people in a timely manner. Keep adequate records where possible.\n`;
    const findings = findingsOf(source, en);
    assert.equal(findings.length, 2, findings.join("\n"));
    assert.match(findings[0] ?? "", /^"as needed" and other vague words: \d+ per 1000 words \(limit 4\)$/u);
  });

  it("長い文書の中の一つ二つは普通の言い方として指さない", () => {
    assert.deepEqual(findingsOf(`${PLAIN_JA.repeat(30)}資料は適宜更新します。\n`), []);
    assert.deepEqual(findingsOf(`${PLAIN_EN.repeat(30)}We update the slides as needed.\n`, en), []);
  });

  it("足した語も数え、言い切った書き方は数えない", () => {
    const vague = `${PLAIN_JA.repeat(15)}障害には臨機応変に対応し、概ね報告します。手順はしっかりと守り、近日中にまとめます。\n`;
    assert.equal(findingsOf(vague).length, 2, findingsOf(vague).join("\n"));
    const plain = `${PLAIN_JA.repeat(15)}障害は発生から一時間以内に報告します。手順書の三章を守り、十月五日までにまとめます。\n`;
    assert.deepEqual(findingsOf(plain), []);
    const vagueEn = `${PLAIN_EN.repeat(13)}Report incidents as soon as practicable and escalate where necessary. Publish notes in due course and ship shortly.\n`;
    assert.equal(findingsOf(vagueEn, en).length, 2, findingsOf(vagueEn, en).join("\n"));
    const plainEn = `${PLAIN_EN.repeat(13)}Report incidents within one hour and escalate to the on-call lead. Publish notes by Friday and ship on Monday.\n`;
    assert.deepEqual(findingsOf(plainEn, en), []);
  });

  it("目次の行は節の名前で、文として数えない", () => {
    const body = `${PLAIN_JA.repeat(15)}障害は適宜報告し、必要に応じて連絡します。記録は適切に残し、なるべく早めにまとめます。\n`;
    const toc = "# 方策\n\n## 目次\n\n- 1 学生が事情に応じて柔軟に履修する仕組み\n\n## 本文\n\n";
    assert.equal(findingsOf(`${toc}${body}`).length, 2, findingsOf(`${toc}${body}`).join("\n"));
    const asProse = `# 方策\n\n## 概要\n\n- 1 学生が事情に応じて柔軟に履修する仕組み\n\n## 本文\n\n`;
    assert.equal(findingsOf(`${asProse}${body}`).length, 3);
  });

  it("a fixed wording (keep data for as long as necessary, the most appropriate template) counts but is not reported", () => {
    const vague = "Report incidents as needed and notify the appropriate people in a timely manner. Keep adequate records where possible.";
    const fixed = `${PLAIN_EN.repeat(13)}${vague} Keep data for as long as necessary. Use the most appropriate issue template.\n`;
    const findings = findingsOf(fixed, en, "docs/manual");
    assert.equal(findings.length, 2, findings.join("\n"));
    // The same words outside the fixed wording, in sentences of the same length: reported, and the density is the same.
    const loose = `${PLAIN_EN.repeat(13)}${vague} Keep records and delete them as necessary. Use the appropriate issue template now.\n`;
    const looseFindings = findingsOf(loose, en, "docs/manual");
    assert.equal(looseFindings.length, 4);
    const densityOf = (finding: string): string => finding.replace(/^.*: /u, "");
    assert.equal(densityOf(findings[0] ?? ""), densityOf(looseFindings[0] ?? ""));
  });

  it("a document whose vague words are all fixed wordings reports nothing, and a sentence with another vague word is still reported", () => {
    const fixedOnly = `${PLAIN_EN.repeat(13)}Keep data for as long as necessary. Use the most appropriate issue template.\n`;
    assert.deepEqual(findingsOf(fixedOnly, en, "docs/manual"), []);
    const mixed = `${PLAIN_EN.repeat(13)}Report as needed, notify the appropriate people, keep adequate records, and keep data for as long as necessary.\n`;
    assert.equal(findingsOf(mixed, en, "docs/manual").length, 1);
  });

  it("reasonable accommodation is the name of a legal duty in any genre, and a bare reasonable is still counted", () => {
    const vague = "Report incidents as needed and notify the appropriate people in a timely manner. Keep adequate records where possible.";
    const named = `${PLAIN_EN.repeat(13)}${vague} Requests for reasonable accommodation go to the disability office.\n`;
    assert.equal(findingsOf(named, en, "docs/manual").length, 2, findingsOf(named, en, "docs/manual").join("\n"));
    const bare = `${PLAIN_EN.repeat(13)}${vague} Requests get a reasonable answer from the office.\n`;
    assert.equal(findingsOf(bare, en, "docs/manual").length, 3);
  });

  it("あいまいな語が無ければ何も言わない", () => {
    assert.deepEqual(findingsOf(`${PLAIN_JA.repeat(10)}\n`), []);
  });

  it("契約の中の法律の基準と決まった言い方は数えず、ほかのジャンルでは数える", () => {
    const standards =
      "The Supplier shall use commercially reasonable efforts to deliver. The Customer shall act reasonably and use best efforts to cooperate. " +
      "The Policy may be amended from time to time. Damages cannot adequately compensate the Owner for a breach. ";
    const source = `${PLAIN_EN.repeat(13)}${standards}\n`;
    assert.deepEqual(findingsOf(source, en, "legal/contract"), []);
    const elsewhere = findingsOf(source, en, "business/report");
    assert.equal(elsewhere.length, 4, elsewhere.join("\n"));
  });

  it("the safeguards and measures a data-protection law names are not counted in a contract, and are elsewhere", () => {
    const duties =
      "The Provider will implement appropriate administrative, physical, and technical safeguards to protect the data. " +
      "The Provider will maintain appropriate technical and organizational safeguards against misuse. " +
      "The Processor shall apply appropriate technical and organisational measures. Transfers rely on appropriate safeguards. ";
    const source = `${PLAIN_EN.repeat(13)}${duties}\n`;
    assert.deepEqual(findingsOf(source, en, "legal/contract"), []);
    const elsewhere = findingsOf(source, en, "business/report");
    assert.equal(elsewhere.length, 4, elsewhere.join("\n"));
  });

  it("契約でも、法律の名指さない appropriate measures は数える", () => {
    const source = `${PLAIN_EN.repeat(13)}The Supplier shall take appropriate measures. It shall notify the appropriate people. It shall keep adequate records.\n`;
    const findings = findingsOf(source, en, "legal/contract");
    assert.equal(findings.length, 3, findings.join("\n"));
  });

  it("契約でも、基準の無いあいまいな語は数える", () => {
    const source = `${PLAIN_EN.repeat(13)}The Supplier shall report incidents as needed. It shall notify the appropriate people where possible. It shall keep adequate records.\n`;
    const findings = findingsOf(source, en, "legal/contract");
    assert.equal(findings.length, 3, findings.join("\n"));
  });
});

const wordsIn = (text: string, genre: string): string[] => {
  const doc = buildDocument("a.md", `${text}\n`, en);
  const termsOfArt = entriesForGenre(doc.lexicons["vague-word-term-of-art"] ?? [], genre);
  return doc.sentences.flatMap((sentence) => vagueWordsIn(sentence, doc.lexicons["vague-word"] ?? [], termsOfArt));
};

describe("vague-word-density: 一つの文の中のあいまいな語", () => {
  it("長い語の中の短い語は、長い語として一度だけ数える", () => {
    assert.deepEqual(wordsIn("Notify us in a timely manner.", "business/report"), ["in a timely manner"]);
    assert.deepEqual(wordsIn("Act as appropriate.", "business/report"), ["as appropriate"]);
  });

  it("別々に書いた語は別々に数える", () => {
    assert.deepEqual(wordsIn("Send a timely reply in a timely manner.", "business/report"), ["timely", "in a timely manner"]);
    assert.deepEqual(wordsIn("Report as needed and keep adequate records.", "business/report"), ["as needed", "adequate"]);
  });

  it("法務のジャンルでは、決まった言い方の中の語を数えない", () => {
    assert.deepEqual(wordsIn("Consent is given on reasonable notice and acted on reasonably.", "legal/contract"), []);
    assert.deepEqual(wordsIn("Damages would not adequately compensate the Owner.", "legal/contract"), []);
    assert.deepEqual(wordsIn("Give reasonable notice as needed.", "legal"), ["as needed"]);
  });

  it("ほかのジャンルでは、同じ語を数える", () => {
    assert.deepEqual(wordsIn("Damages would not adequately compensate the Owner.", "business/report"), ["adequately"]);
    assert.deepEqual(wordsIn("Give reasonable notice as needed.", "blog/tech"), ["reasonable", "as needed"]);
  });

  it("品詞が無くても、同じ物差しで長い語と決まった言い方を見る", () => {
    const sentence = { span: { start: 100, end: 160 }, text: "Notify us in a timely manner, on reasonable notice." };
    const vague = [{ pattern: "timely" }, { pattern: "in a timely manner" }, { pattern: "reasonable" }];
    assert.deepEqual(vagueWordsIn(sentence, vague, []), ["in a timely manner", "reasonable"]);
    assert.deepEqual(vagueWordsIn(sentence, vague, [{ pattern: "reasonable notice" }]), ["in a timely manner"]);
  });

  it("語の無い文と空の文は何も返さない", () => {
    assert.deepEqual(wordsIn("The meeting starts at ten.", "legal/contract"), []);
    assert.deepEqual(wordsIn("", "legal/contract"), []);
  });
});

/** The vague words of each sentence, as the rule reads them, with the language's name markers. */
const wordsWithMarkers = (text: string, adapter = ja): string[] => {
  const doc = buildDocument("a.md", `${text}\n`, adapter);
  const markers = (doc.lexicons["definition-marker"] ?? []).map((entry) => entry.pattern);
  return doc.sentences.flatMap((sentence) => vagueWordsIn(sentence, doc.lexicons["vague-word"] ?? [], [], markers));
};

describe("vague-word-density: すぐ後ろの括弧で中身を決めた語", () => {
  it("括弧が中身を書いていれば、あいまいな語として数えない", () => {
    assert.deepEqual(wordsWithMarkers("一定の事項（請求書に書く必要のある事項）を記載した書類を保存します。"), []);
    assert.deepEqual(wordsWithMarkers("相当の期間(30日)を定めて催告します。"), []);
    assert.deepEqual(wordsWithMarkers("A reasonable fee (USD 50) applies.", en), []);
  });

  it("括弧が無い、離れている、名前を付けるだけ、の語は数える", () => {
    assert.deepEqual(wordsWithMarkers("一定の事項を記載した書類を保存します。"), ["一定の"]);
    assert.deepEqual(wordsWithMarkers("一定の事項を、記録（紙）に残します。"), ["一定の"]);
    assert.deepEqual(wordsWithMarkers("適切な措置（以下「本措置」という。）を講じます。"), ["適切な"]);
    assert.deepEqual(wordsWithMarkers('A reasonable fee (hereinafter the "Fee") applies.', en), ["reasonable"]);
  });
});

/** The vague words of each sentence, as the rule reads them, with the language's law references. */
const wordsUnderLaw = (text: string): string[] => {
  const doc = buildDocument("a.md", `${text}\n`, en);
  const law = lawReferenceOf(doc.lexicons["vague-word-law-reference"] ?? []);
  return doc.sentences.flatMap((sentence) => vagueWordsIn(sentence, doc.lexicons["vague-word"] ?? [], [], [], law));
};

describe("vague-word-density: a vague word a law or a section governs", () => {
  it("a law, a statute's section or a named law right after by / under fixes the requirement", () => {
    assert.deepEqual(wordsUnderLaw("The Provider will not disclose it except as required by applicable law."), []);
    assert.deepEqual(wordsUnderLaw("It keeps an accounting of disclosures as required under 45 CFR §164.528(a)."), []);
    assert.deepEqual(wordsUnderLaw("It reports breaches as required by §164.410 of HIPAA and any incident."), []);
    assert.deepEqual(wordsUnderLaw("It appoints officials as required under HIPAA."), []);
    assert.deepEqual(wordsUnderLaw("It adopts the notice as required by the Privacy Rule."), []);
    assert.deepEqual(wordsUnderLaw("It labels the food as required under the Food Safety Modernization Act."), []);
    assert.deepEqual(wordsUnderLaw("It files the report as necessary pursuant to Section 4.1."), []);
  });

  it("a party, no governing word, a law past the clause or the next governor, and a bare word are still counted", () => {
    assert.deepEqual(wordsUnderLaw("It sends the files as required by Licensor."), ["as required"]);
    assert.deepEqual(wordsUnderLaw("It sends the files as required and keeps a log."), ["as required"]);
    assert.deepEqual(wordsUnderLaw("It sends the files as required, and the law decides the rest."), ["as required"]);
    assert.deepEqual(wordsUnderLaw("It sends the files as required by the customer under the law."), ["as required"]);
    assert.deepEqual(wordsUnderLaw("It takes appropriate steps under applicable law."), ["appropriate"]);
    assert.deepEqual(wordsUnderLaw("It sends the files as required by the lawyer."), ["as required"]);
  });

  it("a document full of law-governed words is not dense, and the bare ones still are", () => {
    const governed = "The Provider discloses data as required by applicable law. It keeps records as required under 45 CFR §164.528. ";
    const contract = findingsOf(`${PLAIN_EN.repeat(13)}${governed.repeat(2)}\n`, en, "legal/contract");
    assert.deepEqual(contract, []);
    const bare = "The Provider discloses data as required. It keeps records as needed. It reports as necessary. ";
    assert.equal(findingsOf(`${PLAIN_EN.repeat(13)}${governed}${bare}\n`, en, "legal/contract").length, 3);
  });
});

describe("governedByLaw", () => {
  const law = { governors: ["by", "under", "pursuant to"], references: ["law", "§", "hipaa"] };

  it("a governing word right after the end, then a law within the clause", () => {
    assert.equal(governedByLaw("as required by law.", 11, law), true);
    assert.equal(governedByLaw("as required pursuant to §164.410", 11, law), true);
    assert.equal(governedByLaw("as required  Under HIPAA", 11, law), true);
  });

  it("no governing word, a governing word glued to another, a law after punctuation, or nothing to read", () => {
    assert.equal(governedByLaw("as required for law", 11, law), false);
    assert.equal(governedByLaw("as required bylaw", 11, law), false);
    assert.equal(governedByLaw("as required by Company, law", 11, law), false);
    assert.equal(governedByLaw("as required by lawyers", 11, law), false);
    assert.equal(governedByLaw("as required", 11, law), false);
    assert.equal(governedByLaw("", 0, law), false);
    assert.equal(governedByLaw("as required by law", 11, NO_LAW_REFERENCE), false);
  });
});

describe("specifiedByBracket", () => {
  const markers = ["以下", "hereinafter"];

  it("a short noun and a closed aside right after the word pin it down", () => {
    assert.equal(specifiedByBracket("一定の事項（記載事項）を残す", 3, markers), true);
    assert.equal(specifiedByBracket("相当の(30日)", 3, markers), true);
    assert.equal(specifiedByBracket("reasonable fee (USD 50)", 10, markers), true);
  });

  it("no bracket, a bracket after punctuation or too far, an empty or unclosed aside, or a name: not pinned down", () => {
    assert.equal(specifiedByBracket("一定の事項を残す", 3, markers), false);
    assert.equal(specifiedByBracket("一定の事項、記録（紙）", 3, markers), false);
    assert.equal(specifiedByBracket("一定のとても長い名前の付いた書類の事項（紙）", 3, markers), false);
    assert.equal(specifiedByBracket("一定の事項（）を残す", 3, markers), false);
    assert.equal(specifiedByBracket("一定の事項（記載事項を残す", 3, markers), false);
    assert.equal(specifiedByBracket("適切な措置（以下「本措置」という。）", 3, markers), false);
    assert.equal(specifiedByBracket("", 0, markers), false);
    assert.equal(specifiedByBracket("一定の", 10, []), false);
  });
});
