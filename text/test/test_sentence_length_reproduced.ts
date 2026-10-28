import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isReproduced, reproducedSpans } from "../packages/chaff/src/detectors/reproduced-text.ts";

// max-sentence-length and text the writer copies from another document word for word: the articles of a statute under a
// heading that names it, and the paragraph after a lead-in that says it is reproduced ("reads as follows:"). The writer
// cannot shorten them. A long sentence of the writer's own beside them is still reported. Every text here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const RULE = "max-sentence-length";
const jaFindings = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja, "a.md", "docs/manual").findings;
const enFindings = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en, "a.md", "blog/owned-media").findings;

const ARTICLE =
  "第3条 書類を郵便により提出しようとする者は、その書類に記載すべき事項を記録した電磁的記録を、当該書類を提出した日から町の規則で定める期間内に、町の規則で定めるところにより、町長に提出しなければならないが、町長が特別の事情があると認めた場合は、町長が定める期間内に提出することができるものとし、その期間を過ぎて提出した場合における手数料の額は、町の規則で定める。";
const OWN_LONG =
  "書類を郵便で出した方は、その内容を記録したデータを、書類を出した日から決められた期間内に、決められた方法で町長に出す必要がありますが、町長が特別の事情があると認めた場合には別の期間内に出すこともでき、その期間を過ぎてから出した場合の手数料の額は町の規則で決まっているので、窓口で確かめてから出すようにしてください。";

const manual = (body: string): string => ["# 手数料のご案内", "", "＜根拠条文：書類の提出に関する法律第3条＞", "", OWN_LONG, "", body].join("\n");

describe("articles of a statute copied under a heading that names it", () => {
  it("does not measure them when the document cites the statute by that name", () => {
    const findings = jaFindings(manual(["## 参考：根拠条文", "", "### 書類の提出に関する法律", "", ARTICLE].join("\n")));
    assert.equal(findings.length, 1, findings.join("\n"));
  });

  it("still measures an article under a heading that names no cited document", () => {
    const findings = jaFindings(manual(["## 手続の決まり", "", ARTICLE].join("\n")));
    assert.equal(findings.length, 2, findings.join("\n"));
  });
});

const LEAD = "The entire letter reads as follows:";
const LETTER =
  "I this day place with the bank, at my own risk from loss by fire or theft, one silver box and its key, on which the bank has lent me ten dollars, and I hereby give the bank the right to sell the box at any sale to pay the loan if the same is not paid by the first day of May.";
const AFTER =
  "Nobody knows what the writer did with the ten dollars he borrowed, but the family later said that he spent all of it on seed for the farm, on a coat for his son and on paying the tax that was due that spring.";

describe("a paragraph after a lead-in that says it is reproduced", () => {
  it("is not measured", () => {
    assert.deepEqual(enFindings(["# The letter", "", LEAD, "", LETTER].join("\n")), []);
  });

  it("still measures the paragraph after it, and a paragraph after a colon that does not say it is reproduced", () => {
    assert.equal(enFindings(["# The letter", "", LEAD, "", LETTER, "", AFTER].join("\n")).length, 1);
    assert.equal(enFindings(["# The letter", "", "Here is what the letter asked of the bank:", "", LETTER].join("\n")).length, 1);
    assert.equal(enFindings(["# The letter", "", "The entire letter reads as follows.", "", LETTER].join("\n")).length, 1);
  });

  it("reads the lead-in only at the end of the paragraph before, and only for the next one", () => {
    const source = `Intro.\n\n${LEAD}\n\nText.\n\nMore.`;
    const paragraph = (start: number, end: number): { readonly span: { start: number; end: number }; readonly sentences: [] } => ({
      span: { start, end },
      sentences: [],
    });
    const paragraphs = [
      paragraph(0, 6),
      paragraph(8, 8 + LEAD.length),
      paragraph(10 + LEAD.length, 15 + LEAD.length),
      paragraph(17 + LEAD.length, source.length),
    ];
    const spans = reproducedSpans(undefined, paragraphs, source, ["reads as follows"]);
    assert.deepEqual(spans, [paragraphs[2]?.span]);
    assert.equal(isReproduced({ start: 10 + LEAD.length, end: 15 + LEAD.length }, spans), true);
    assert.equal(isReproduced({ start: 17 + LEAD.length, end: source.length }, spans), false);
    assert.deepEqual(reproducedSpans(undefined, paragraphs, source, []), []);
    assert.deepEqual(reproducedSpans(undefined, [], source, ["reads as follows"]), []);
  });
});
