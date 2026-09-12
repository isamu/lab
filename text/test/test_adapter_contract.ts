import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { packageFor } from "../packages/chaff/src/adapter-load.ts";

const adapters: readonly LanguageAdapter[] = [ja, en];

describe("LanguageAdapter の契約", () => {
  adapters.forEach((target) => {
    describe(target.id, () => {
      it("apiVersion が 1 で、文分割の capability を持つ", () => {
        assert.equal(target.apiVersion, 1);
        assert.equal(target.kind, "language");
        assert.equal(target.capabilities.sentenceSplit, true);
      });

      it("品詞解析を宣言し、それを払う prepare を持つ", () => {
        // capabilities は「払えばできる」の宣言。片方だけだと、要求を満たせるのに
        // 満たさない（prepare 無し）か、宣言なしに読み込む（capability 無し）になる。
        assert.equal(target.capabilities.pos, true);
        assert.equal(typeof target.prepare, "function");
      });

      it("要求されなければ解析器を読まない", async () => {
        // この file は一度も pos を要求しない。要求しないまま読み込まれていたら tokens が入る。
        await target.prepare?.({ pos: false });
        assert.equal(target.segment("これは文です。 This is a sentence.").sentences[0]?.tokens, undefined);
      });

      it("core からアダプタ名を引ける", () => {
        assert.equal(typeof packageFor(target.id), "string");
      });

      it("detect が 0..1 を返す", () => {
        const score = target.detect("キャッシュ cache 3.5");
        assert.ok(score >= 0 && score <= 1, `detect returned ${String(score)}`);
      });
    });
  });

  it("未知の言語にはアダプタが無い", () => {
    assert.equal(packageFor("ko"), undefined);
  });
});
