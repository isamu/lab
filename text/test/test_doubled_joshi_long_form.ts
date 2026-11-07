import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { namedLongForms } from "../packages/chaff/src/detectors/particle-run-long-forms.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { namedRuleRun } from "./rule-run.ts";

// no-doubled-joshi: 短い呼び名を付けた長い名前（…のための相談センター（以下「センター」という。））は名前なので、中の「の」を数えない。例文は自作。

const chains = (body: string): readonly string[] => namedRuleRun("no-doubled-joshi", `# 報告\n\n${body}\n`, ja, "a.md", "business/report").findings;

const posOf = (surface: string): string => {
  if (surface === "の") return "ADP";
  return /^[、（「」）]$/u.test(surface) ? "PUNCT" : "NOUN";
};

const tokensOf = (...surfaces: string[]): Token[] =>
  surfaces.reduce<Token[]>((tokens, surface) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    return [...tokens, { surface, pos: posOf(surface), span: { start, end: start + surface.length } }];
  }, []);

const continues = (token: Token): boolean => token.surface === "の" || token.pos === "NOUN";

describe("namedLongForms", () => {
  it("呼び名を付ける括弧の前の語句を、名前の続かない語の後ろから", () => {
    const tokens = tokensOf("今年", "、", "被害者", "の", "ため", "の", "センター", "（", "以下", "「", "C", "」", "）");
    const text = tokens.map((token) => token.surface).join("");
    assert.deepEqual(namedLongForms(text, 0, tokens, ["以下"], continues), [{ start: 3, end: 14 }]);
    assert.deepEqual(namedLongForms(`前置き${text}`, 3, tokens, ["以下"], continues), [], "文の位置が合わなければ読まない");
  });

  it("呼び名でない括弧、語の途中の括弧、印の無い言語、空の文は何も返さない", () => {
    const tokens = tokensOf("被害者", "の", "センター", "（", "東京", "）");
    const text = tokens.map((token) => token.surface).join("");
    assert.deepEqual(namedLongForms(text, 0, tokens, ["以下"], continues), []);
    assert.deepEqual(namedLongForms("（以下「C」）", 0, tokensOf("（", "以下"), ["以下"], continues), []);
    assert.deepEqual(namedLongForms("センター（以下）", 0, tokensOf("センター", "（", "以下", "）"), [], continues), []);
    assert.deepEqual(namedLongForms("センター（以下）", 0, tokensOf("センター", "（", "以下", "）"), [""], continues), []);
    assert.deepEqual(namedLongForms("", 0, [], ["以下"], continues), []);
  });
});

describe("no-doubled-joshi: 呼び名を付けた長い名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("（以下「…」という）の前の名前の「の」を数えない", () => {
    assert.deepEqual(chains("事故の被害者のための相談センター（以下「センター」といいます。）に、相談が寄せられています。"), []);
    assert.deepEqual(chains("地域の住民の生活の支援の窓口(以下、窓口)を開きました。"), []);
  });

  it("呼び名の無い括弧と、ほかの「の」の連なりは今までどおり言う", () => {
    assert.equal(chains("事故の被害者のための相談センター（東京）に、相談が寄せられています。").length, 1);
    assert.equal(chains("本社の営業部の第二課の方針を確認しました。").length, 1);
    assert.equal(chains("本社の営業部の第二課の方針を、窓口（以下「窓口」という。）で確認しました。").length, 1);
  });
});
