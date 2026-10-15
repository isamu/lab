import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinCompanyFormRegExp, latinCompanyFormSpans } from "../packages/chaff/src/latin-company-form.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";

// 日本語の文の中の、英字の会社の名前の後ろに立つ形（CO.，LTD.）。例はすべて自作。

const FORMS = (loadLexicons()["company-form-latin"] ?? []).map((entry) => entry.pattern);
const PATTERN = latinCompanyFormRegExp(FORMS);

const formsIn = (text: string): string[] => latinCompanyFormSpans(text, PATTERN).map((span) => text.slice(span.start, span.end));

describe("latinCompanyFormSpans: 英字の会社の形", () => {
  it("語彙表がある", () => {
    assert.ok(FORMS.includes("Co., Ltd."));
  });

  it("大文字・小文字、全角・半角、「，」の後ろの空白の有無を問わない", () => {
    assert.deepEqual(formsIn("AOBA CO.,LTD.が"), ["CO.,LTD."]);
    assert.deepEqual(formsIn("AOBA Co., Ltd.が"), ["Co., Ltd."]);
    assert.deepEqual(formsIn("ＡＯＢＡ ＣＯ．，ＬＴＤ．が"), ["ＣＯ．，ＬＴＤ．"]);
    assert.deepEqual(formsIn("AOBA(THAILAND)CO.，LTD.が"), ["CO.，LTD."]);
  });

  it("点まで書いたとおりに照らす（点の無い INC は形ではない）", () => {
    assert.deepEqual(formsIn("AOBA USA INC.、"), ["INC."]);
    assert.deepEqual(formsIn("AOBA USA INC、"), []);
  });

  it("長い形を先に取る", () => {
    assert.deepEqual(formsIn("AOBA MEXICO S.A. DE C.V.が"), ["S.A. DE C.V."]);
  });

  it("英字の語の中や、略語の中の同じ字は形ではない（Zinc、INCOME、U.S.A.）", () => {
    assert.deepEqual(formsIn("Zinc と INCOME と U.S.A. と LLCs"), []);
  });

  it("前に名前の無い所の同じ字は形ではない（LTDの基金、文の頭の LLC）", () => {
    assert.deepEqual(formsIn("LTDの基金と、LLC は"), []);
    assert.deepEqual(formsIn("the LTD fund. LLC filings, the LLC."), []);
  });

  it("名前と形のあいだは空白か「,」（AOBA,INC.）", () => {
    assert.deepEqual(formsIn("AOBA,INC.を買収"), ["INC."]);
    assert.deepEqual(formsIn("AOBA、INC.を買収"), []);
  });

  it("語彙表が空なら何も無い", () => {
    assert.equal(latinCompanyFormRegExp([]), undefined);
    assert.deepEqual(latinCompanyFormSpans("AOBA CO.,LTD.", undefined), []);
  });
});
