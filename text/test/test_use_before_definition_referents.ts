import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// use-before-definition reads a definition as the document's own only where the document makes it: a definition inside an
// article copied from another statute, and a term that points back to a longer name written before it, are not early uses.

const early = (source: string, adapter = ja): readonly string[] => namedRuleRun("use-before-definition", source, adapter, "a.md").findings;

const COPIED = "第9条 長官は、その登録を受けた者（以下「登録機関」という。）に、記録の業務を行わせることができる。\n";
const notice = (heading: string): string =>
  `# 手数料の案内\n\n書面の手続は、登録機関が電子化します。この費用は、特例法第9条に基づく手数料です。\n\n## 参考：根拠条文\n\n### ${heading}\n\n${COPIED}`;

describe("use-before-definition: a definition in an article copied from another document", () => {
  it("is that document's definition, so an earlier use in the page is not reported", () => {
    assert.deepEqual(early(notice("特例法")), []);
  });

  it("is still the page's own when the heading names no document the page cites", () => {
    assert.deepEqual(early(notice("条文")), ["「登録機関」を、9 行目の定義より前で使っています"]);
  });
});

describe("use-before-definition: a term that points back to a longer name", () => {
  const later = 'By the authority of the Records Disclosure Act (Public Law 105–246) (the "Act"), it is ordered as follows.\n';

  it("is not reported after the document writes a longer name ending in it", () => {
    const source = `The National Security Act of 1947 is classified to chapter 44. Section 3 of the Act is now section 3003.\n\nOther text.\n\n${later}`;
    assert.deepEqual(early(source, en), []);
  });

  it("is still reported before any such name, and where no longer name is written", () => {
    assert.deepEqual(early(`Section 3 of the Act is now section 3003. The National Security Act of 1947 is classified.\n\n${later}`, en), [
      '"Act" is used here, before it is defined on line 3',
    ]);
    assert.deepEqual(early(`Section 3 of the Act is now section 3003.\n\n${later}`, en), ['"Act" is used here, before it is defined on line 3']);
  });
});

describe("use-before-definition: an introduction names what the body defines", () => {
  const body = "## 方策\n\n修業年限を短くしたコース（以下「短期コース」という。）を設ける。\n";

  it("is not a use under a heading that is the whole of an introduction heading", () => {
    assert.deepEqual(early(`### はじめに\n\n短期コースの導入について検討する。\n\n${body}`), []);
    assert.deepEqual(
      early(`## Introduction\n\nWe consider the Short Course.\n\n## Proposal\n\nA course of one year (the "Short Course") is set up.\n`, en),
      [],
    );
  });

  it("is still a use under another heading", () => {
    assert.deepEqual(early(`### 経緯\n\n短期コースの導入について検討する。\n\n${body}`), ["「短期コース」を、7 行目の定義より前で使っています"]);
  });
});
