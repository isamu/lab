import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { isMostlyNames, isOneName } from "../packages/chaff/src/detectors/name-run.ts";
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

/** 文字列全体を 1 つの漢字の連なりとして、名前が大半を占めるかを判定する。 */
const isMostlyNamed = (run: string): boolean => {
  const tokens = tokensOf(run);
  return isMostlyNames(
    tokens,
    tokens.map((_, index) => index),
  );
};

describe("isMostlyNames — 名前を並べて組み立てた 1 つの名前か", () => {
  before(async () => {
    await prepare();
  });

  it("valid: 字の半分以上が固有名詞で、普通の語を含む名前（地震や災害の名前、名前に短い語が続くもの）", () => {
    assert.ok(isMostlyNamed("東北地方太平洋沖地震"));
    assert.ok(isMostlyNamed("阪神淡路大震災"));
    assert.ok(isMostlyNamed("東日本大震災"));
    assert.ok(isMostlyNamed("新東京国際空港公団総務部長"));
  });

  it("invalid: 普通の語の方が長い連なり（名前に組み立てた語が続く、固有名詞の無い複合語）", () => {
    assert.ok(!isMostlyNamed("日本弁護士連合会臨時総会決議"));
    assert.ok(!isMostlyNamed("千島海溝周辺海溝型地震"));
    assert.ok(!isMostlyNamed("東京電力福島第一原子力発電所事故"));
    assert.ok(!isMostlyNamed("新規顧客獲得施策検討会議"));
  });

  it("invalid: 普通の語を含まない名前の並び（地名や人の名前を続けただけ）", () => {
    assert.ok(!isMostlyNamed("東京大阪名古屋福岡"));
    assert.ok(!isMostlyNamed("北海道神奈川県横浜市"));
    assert.ok(!isMostlyNamed("田中一郎山田花子"));
  });

  it("invalid: 1 字の固有名詞は名前の字に数えない。語が無い・範囲の外", () => {
    assert.ok(!isMostlyNames([token("東", "PROPN", "Geo"), token("京", "NOUN")], [0, 1]));
    assert.ok(!isMostlyNames([], []));
    assert.ok(!isMostlyNames([token("東北", "PROPN", "Geo"), token("地方", "NOUN")], []));
    assert.ok(!isMostlyNames([token("東北", "PROPN", "Geo"), token("地方", "NOUN")], [5]));
  });
});
