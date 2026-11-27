import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { spacedNameSpans } from "../packages/chaff/src/detectors/spaced-name.ts";

// undefined-acronym and capitals written apart from the word of a name the document also writes as one word (JS Conf beside
// JSConf). Examples are self-written.

const spaced = (text: string): string[] => spacedNameSpans(text).map((span) => text.slice(span.start, span.end));

describe("spacedNameSpans", () => {
  it("valid: the capitals of a spaced name whose joined form the text holds, wherever it is", () => {
    assert.deepEqual(spaced("Meet at QZConf.\nResults at QZ Conf (Oct. 16)."), ["QZ"]);
    assert.deepEqual(spaced("QZ Conf first, QZConf later."), ["QZ"]);
  });

  it("invalid: no joined form, a joined form inside a longer word, a lower-case word, empty text", () => {
    assert.deepEqual(spaced("Results at QZ Conf."), []);
    assert.deepEqual(spaced("Results at QZ Conf, see QZConfig."), []);
    assert.deepEqual(spaced("The QZ conf is QZconf."), []);
    assert.deepEqual(spaced(""), []);
  });
});

describe("undefined-acronym: a name written apart and joined", () => {
  it("valid: the spaced capitals are not reported, in English and in Japanese", () => {
    const source = "# Minutes\n\n- Next meeting at QZConf\n- Decisions announced at QZ Conf (Oct. 16).\n\nThe SRE joins the call.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["SRE"]);
    const jaSource = "# 議事録\n\n- 次回は QZConf で開く。\n- 結果は QZ Conf で知らせる。\n\nSREが対応する。\n";
    assert.deepEqual(reportedAcronyms(ja, jaSource), ["SRE"]);
  });

  it("invalid: without the joined form the capitals are still reported", () => {
    const source = "# Minutes\n\n- Decisions announced at QZ Conf (Oct. 16).\n\nThe SRE joins the call.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["QZ", "SRE"]);
  });
});
