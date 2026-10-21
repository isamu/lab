import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym: an acronym expanded with another name in the same parenthesis (HHS or the Department), an acronym with
// a letter joined by a hyphen (ARPA-H), the name in an email address, and international bodies a reader knows (WHO, ASEAN).
// The English sentences are from Federal Register notices of the US Department of Health and Human Services (US government
// works, public domain); the Japanese ones from the 令和6年版高齢社会白書 (内閣府, 公共データ利用規約 第1.0版 / PDL1.0).

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const PENDING = { en: "The SRE, XYZ and QRS are pending.", ja: "SRE、XYZ、QRSは保留。" };

describe("undefined-acronym: another name for the same body, after or, in the parenthesis", () => {
  it("the name before the parenthesis spells the acronym (HHS or the Department, FDA or the Agency)", () => {
    const notice = `# RFI\n\nAGENCY: U.S. Department of Health and Human Services (HHS or the Department).\n\nThe Food and Drug Administration (FDA or the Agency) will read the comments. HHS and FDA thank you. ${PENDING.en}\n`;
    assert.deepEqual(reportedAcronyms(en, notice), ["SRE", "XYZ", "QRS"]);
  });

  it("not when the name before does not spell the acronym, or the parenthesis lists two bodies", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nThe rules apply to everyone (EPA or the states). ${PENDING.en}\n`), ["EPA", "SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\nThe Department of Health and Human Services (HHS and the Department) met. ${PENDING.en}\n`), [
      "HHS",
      "SRE",
      "XYZ",
      "QRS",
    ]);
  });
});

describe("undefined-acronym: an acronym with a letter joined by a hyphen", () => {
  it("expanded when the name spells the acronym and its letter (Agency for Health (ARPA-H))", () => {
    const notice = `# RFI\n\nHHS, through the Advanced Research Projects Agency for Health (ARPA-H), is funding a program. ARPA-H reports yearly. ${PENDING.en}\n`;
    assert.deepEqual(reportedAcronyms(en, notice), ["HHS", "SRE", "XYZ", "QRS"]);
  });

  it("not when the joined letter is not in the name, or the letter is not followed by the closing parenthesis", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nThe Advanced Research Projects Agency (ARPA-H) funds it. ${PENDING.en}\n`), ["ARPA", "SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\nThe Advanced Research Projects Agency for Health (ARPA-H program) funds it. ${PENDING.en}\n`), [
      "ARPA",
      "SRE",
      "XYZ",
      "QRS",
    ]);
  });
});

describe("undefined-acronym: the name in an email address", () => {
  it("capitals before the @ are the address, not an acronym", () => {
    const notice = `# RFI\n\nFOR FURTHER INFORMATION CONTACT: Victoria Marshall, Office of the Assistant Secretary for Health, OASH-RFI@hhs.gov.\n\n${PENDING.en}\n`;
    assert.deepEqual(reportedAcronyms(en, notice), ["SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(ja, `# 問合せ\n\n問合せは OASH-RFI@hhs.gov へ。${PENDING.ja}\n`), ["SRE", "XYZ", "QRS"]);
  });

  it("the same capitals outside an address are still counted", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nWrite to OASH-RFI at the office, or to help@hhs.gov. ${PENDING.en}\n`), ["OASH-RFI", "SRE", "XYZ", "QRS"]);
  });
});

describe("undefined-acronym: international bodies a reader knows (WHO, ASEAN)", () => {
  it("WHO and ASEAN are not reported in a white paper; an unknown acronym still is", () => {
    const paper = `# 国際協力\n\nWHO総会、WHO西太平洋地域委員会、国連総会等の国際的な議論の場において発信した。ASEAN・日本社会保障ハイレベル会合を開催した。${PENDING.ja}\n`;
    assert.deepEqual(reportedAcronyms(ja, paper), ["SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\nThe WHO and ASEAN met. ${PENDING.en}\n`), ["SRE", "XYZ", "QRS"]);
  });
});
