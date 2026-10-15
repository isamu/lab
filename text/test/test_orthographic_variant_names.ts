import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isCoinedName, withoutCoinedNames } from "../packages/chaff/src/coined-hyphen-name.ts";

// orthographic-variant (en): a name is not a spelling of a word. A name in a passage in capitals (eGAIN in a disclaimer) and a
// name coined from pieces (Medi-Cal beside medical). Every example is self-written.

const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, en).findings;

const DICTIONARY = new Set(["working", "mail", "processor", "medical", "cal"]);
const isWord = (word: string): boolean => DICTIONARY.has(word);

describe("isCoinedName: a hyphenated name of capitalised pieces, one of them not a word", () => {
  it("coined names", () => {
    assert.equal(
      isCoinedName("Medi-Cal", () => false),
      true,
    );
    assert.equal(isCoinedName("Wi-Fi", isWord), true);
    assert.equal(isCoinedName("Aqua-Vista-Lumo", isWord), true);
  });

  it("not coined: later pieces that are words, a small or all-capital piece, no hyphen", () => {
    assert.equal(isCoinedName("Co-Working", isWord), false);
    assert.equal(isCoinedName("Sub-Processor", isWord), false);
    assert.equal(isCoinedName("Medi-Cal", isWord), false);
    assert.equal(isCoinedName("co-fi", isWord), false);
    assert.equal(isCoinedName("Medi-CAL", isWord), false);
    assert.equal(isCoinedName("Medical", isWord), false);
    assert.equal(isCoinedName("", isWord), false);
  });
});

describe("withoutCoinedNames: a coined name beside a word written only in small letters", () => {
  const word = (key: string, spelling: string, shown?: string): { key: string; spelling: string; shown?: string } =>
    shown === undefined ? { key, spelling } : { key, spelling, shown };

  it("drops the coined name beside the small-letter word, keeps it beside a spelling with capitals", () => {
    const medical = [word("latin|medical", "medical"), word("latin|medical", "medi-cal", "Medi-Cal")];
    assert.deepEqual(
      withoutCoinedNames(medical, () => false),
      [word("latin|medical", "medical")],
    );
    const wifi = [word("latin|wifi", "wiFi", "WiFi"), word("latin|wifi", "wi-fi", "Wi-Fi")];
    assert.deepEqual(
      withoutCoinedNames(wifi, () => false),
      wifi,
    );
    assert.deepEqual(
      withoutCoinedNames([], () => false),
      [],
    );
  });
});

describe("orthographic-variant (en): names that are not spellings of a word", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("a company name inside a passage in capitals", () => {
    const contract =
      "aObA Systems hosts the service. aObA Systems backs up the data. aObA Systems sends a report.\n\n7. Warranty. THE SERVICE IS PROVIDED AS IS, AND aOBA MAKES NO OTHER WARRANTY.\n";
    assert.deepEqual(findingsOf(contract), []);
  });

  it("the same name with other capitals in ordinary text is still reported", () => {
    assert.deepEqual(findingsOf("aObA Systems hosts the service. aObA Systems backs up the data. Later aOBA sends a report.\n"), [
      '"aOBA" here, where the document usually writes "aObA" (1 of 3)',
    ]);
  });

  it("a programme's coined name beside the ordinary word", () => {
    assert.deepEqual(findingsOf("Members get medical care. The medical plan pays for it. Each medical claim is checked. The Medi-Cal plan is separate.\n"), []);
  });

  it("a hyphen inside an ordinary word is still reported", () => {
    assert.deepEqual(findingsOf("Book a coworking desk. The coworking room opens at nine. Co-Working passes are sold at the desk.\n"), [
      '"Co-Working" here, where the document usually writes "coworking" (1 of 3)',
    ]);
  });
});
