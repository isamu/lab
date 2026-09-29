import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { isAddressRun } from "../packages/chaff/src/detectors/place-run.ts";
import { prepare, tokenize } from "../packages/lang-ja/src/pos.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

const tokensOf = (text: string): Token[] => {
  const tokens = tokenize(text);
  if (tokens === undefined) throw new Error("形態素解析が用意できていない");
  return tokens;
};

/** 住所の先頭にしか来ない単位。日本語の語彙表（lexicons/prefecture-unit.yaml）から読む。 */
const TOP_UNITS: ReadonlySet<string> = new Set((loadLexicons()["prefecture-unit"] ?? []).map((entry) => entry.pattern));

/** 文字列全体を 1 つの漢字の連なりとして判定する。 */
const isAddress = (run: string): boolean => {
  const tokens = tokensOf(run);
  return isAddressRun(
    tokens,
    tokens.map((_, index) => index),
    TOP_UNITS,
  );
};

/** text のうち、先頭から run の長さまでを連なりとして判定する（後ろの語は連なりの外）。 */
const isAddressPrefix = (text: string, run: string): boolean => {
  const tokens = tokensOf(text);
  const covering = tokens.flatMap((token, index) => (token.span.end <= run.length ? [index] : []));
  return isAddressRun(tokens, covering, TOP_UNITS);
};

describe("isAddressRun — 漢字の連なりが住所か", () => {
  before(async () => {
    await prepare();
  });

  it("前提: 形態素解析が町名を割る（割れていなければ、下の判定は試されていない）", () => {
    // 紀美野町は 紀（人名）＋美野（地名）、南伊勢町は 南（普通の語）＋伊勢、北海道虻田郡は地名が 2 つ続く。
    assert.deepEqual(
      tokensOf("紀美野町").map((token) => token.surface),
      ["紀", "美野", "町"],
    );
    assert.equal(tokensOf("紀美野町")[0]?.features?.["NameType"], "Sur");
    assert.deepEqual(
      tokensOf("南伊勢町").map((token) => token.surface),
      ["南", "伊勢", "町"],
    );
    assert.equal(tokensOf("南伊勢町")[0]?.pos, "NOUN");
    assert.deepEqual(
      tokensOf("北海道虻田郡").map((token) => token.features?.["NameType"]),
      ["Geo", "Geo", "GeoUnit"],
    );
  });

  it("valid: 辞書に無い町名が割れていても、単位で閉じれば住所", () => {
    // 紀美野町のお知らせ（kimino-cleanup-notice）にある所在地。
    assert.ok(isAddress("和歌山県海草郡紀美野町動木"));
    assert.ok(isAddress("三重県度会郡南伊勢町"));
    assert.ok(isAddress("石川県鳳珠郡能登町"));
    assert.ok(isAddress("沖縄県島尻郡久米島町"));
  });

  it("valid: 地名が 2 つ続いて単位で閉じれば、割られた 1 つの地名", () => {
    assert.ok(isAddress("北海道虻田郡倶知安町"));
    assert.ok(isAddress("山梨県南都留郡富士河口湖町"));
    assert.ok(isAddress("山口県大島郡周防大島町"));
    assert.ok(isAddress("北海道札幌市中央区"));
  });

  it("valid: これまでどおり、地名・単位・数・丁目だけの連なりは住所", () => {
    assert.ok(isAddress("東京都港区新橋二丁目"));
    assert.ok(isAddress("神奈川県横浜市中区山下町"));
  });

  it("invalid: 地名の後ろに普通の語（2 字以上）が続けば住所ではない", () => {
    assert.ok(!isAddress("和歌山県海草郡紀美野町役場総務課"));
    assert.ok(!isAddress("紀美野町青少年育成町民会議"));
    assert.ok(!isAddress("東京都港区政策経営部"));
    assert.ok(!isAddress("埼玉県市町村総合事務組合"));
  });

  it("前提: 都道府県の単位は語彙表にある（無ければ下の「並び」の判定は試されていない）", () => {
    assert.deepEqual(TOP_UNITS, new Set(["都", "道", "府", "県"]));
  });

  it("invalid: 地名の並びは、単位で終わっても住所ではない", () => {
    assert.ok(!isAddress("東京大阪名古屋福岡"));
    assert.ok(!isAddress("東京大阪名古屋福岡県"));
    assert.ok(!isAddress("京都奈良大阪神戸市"));
    // 都道府県の単位は住所の先頭にしか来ない。地名の後ろに付けば並び。
    assert.ok(!isAddress("北海道神奈川県"));
    assert.ok(!isAddress("和歌山大阪府"));
    assert.ok(!isAddress("東京都港区紀和歌山県"));
    // 都道府県の段は語彙表が言う。渡さなければ、単位で閉じた 2 つの地名は 1 つの地名として通る。
    const pair = tokensOf("北海道神奈川県");
    assert.ok(
      isAddressRun(
        pair,
        pair.map((_, index) => index),
        new Set(),
      ),
    );
  });

  it("invalid: 単位で閉じるかは連なりの中だけで見る（連なりの外の「郡」では閉じない）", () => {
    assert.ok(isAddressPrefix("北海道虻田郡", "北海道虻田郡"));
    assert.ok(!isAddressPrefix("北海道虻田郡", "北海道虻田"));
  });

  it("invalid: 割られた町名のかけらは 1 つだけ。かけらが続けば住所ではない", () => {
    // 田中（人名）＋太郎（人名）＋町。かけらが 2 つ続く。
    assert.ok(!isAddress("東京都港区田中太郎町"));
  });

  it("invalid: 2 字以上の普通の語は、単位で閉じても地名のかけらではない", () => {
    assert.ok(!isAddress("東京都港区案件町"));
    assert.ok(!isAddress("大阪府堺市南北町"));
  });

  it("invalid: 地名で始まらないもの、空のもの", () => {
    assert.ok(!isAddress("三百二十五万四千八百人"));
    assert.ok(!isAddress("個人情報保護委員会"));
    assert.ok(!isAddressRun(tokensOf("東京都"), [], TOP_UNITS));
  });
});
