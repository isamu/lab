import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { isOneName } from "../packages/chaff/src/detectors/name-run.ts";
import { prepare, tokenize } from "../packages/lang-ja/src/pos.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

const tokensOf = (text: string): Token[] => {
  const tokens = tokenize(text);
  if (tokens === undefined) throw new Error("形態素解析が用意できていない");
  return tokens;
};

const nameTypes = (text: string): (string | undefined)[] => tokensOf(text).map((token) => token.features?.["NameType"]);

/** 文字列全体を 1 つの漢字の連なりとして判定する。 */
const isName = (run: string): boolean => {
  const tokens = tokensOf(run);
  return isOneName(
    tokens,
    tokens.map((_, index) => index),
  );
};

const token = (surface: string, pos: string, nameType?: string): Token => ({
  span: { start: 0, end: surface.length },
  surface,
  pos,
  ...(nameType === undefined ? {} : { features: { NameType: nameType } }),
});

describe("固有名詞の種類（lang-ja の NameType）", () => {
  before(async () => {
    await prepare();
  });

  it("人名は姓 Sur・名 Giv、姓名の分からない人名は Prs", () => {
    assert.deepEqual(nameTypes("田中太郎"), ["Sur", "Giv"]);
    assert.deepEqual(nameTypes("聖徳太子"), ["Prs"]);
  });

  it("組織名は Com、地名は今までどおり Geo と GeoUnit", () => {
    assert.deepEqual(nameTypes("日本銀行"), ["Com"]);
    assert.deepEqual(nameTypes("東京都"), ["Geo", "GeoUnit"]);
  });

  it("固有名詞でない語には付けない", () => {
    assert.deepEqual(nameTypes("個人情報保護委員会"), [undefined, undefined, undefined, undefined, undefined]);
    assert.equal(tokensOf("田中太郎")[0]?.pos, "PROPN");
    // 敬称は IPADIC で「接尾,人名」。人名の語ではない。
    assert.deepEqual(nameTypes("田中さん"), ["Sur", undefined]);
  });
});

describe("isOneName — 漢字の連なりが 1 つの名前か", () => {
  before(async () => {
    await prepare();
  });

  it("valid: 辞書が 1 語の固有名詞と読むもの", () => {
    assert.ok(isName("新東京国際空港公団"));
    assert.ok(isName("動力炉核燃料開発事業団"));
    assert.ok(isName("聖徳太子"));
  });

  it("valid: 人の姓と名", () => {
    assert.ok(isName("田中太郎"));
    assert.ok(isOneName([token("田中", "PROPN", "Sur"), token("太郎", "PROPN", "Giv")], [0, 1]));
  });

  it("invalid: 固有名詞に普通の語が続けば、名前から組み立てた語", () => {
    assert.ok(!isName("新東京国際空港公団総務部"));
    assert.ok(!isName("武蔵野美術大学造形構想学部"));
    assert.ok(!isName("東京都知事選挙管理委員会事務局"));
    assert.ok(!isName("日本経済団体連合会"));
  });

  it("invalid: 名前が続けば並び", () => {
    assert.ok(!isName("田中一郎山田花子"));
    assert.ok(!isName("田中山田"));
    assert.ok(!isName("太郎花子"));
    assert.ok(!isName("日本銀行新東京国際空港公団"));
    assert.ok(!isOneName([token("太郎", "PROPN", "Giv"), token("田中", "PROPN", "Sur")], [0, 1]));
    assert.ok(!isOneName([token("田中", "PROPN", "Sur"), token("太郎", "PROPN", "Giv"), token("花子", "PROPN", "Giv")], [0, 1, 2]));
  });

  it("invalid: 普通の語や、辞書が固有名詞と読まない正式名称", () => {
    assert.ok(!isName("個人情報保護委員会"));
    assert.ok(!isName("情報処理推進機構"));
    assert.ok(!isOneName([token("委員会", "NOUN")], [0]));
  });

  it("invalid: 語が無い・範囲の外", () => {
    assert.ok(!isOneName([], []));
    assert.ok(!isOneName([token("日本銀行", "PROPN", "Com")], []));
    assert.ok(!isOneName([token("日本銀行", "PROPN", "Com")], [1]));
    assert.ok(!isOneName([token("田中", "PROPN", "Sur")], [0, 1]));
  });
});
