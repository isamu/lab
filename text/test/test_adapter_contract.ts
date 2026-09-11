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

      it("MVP では品詞解析を持たない（Tier 0）", () => {
        // spec §16。持つようになったら、この期待を変えるより先に setup の導線を用意すること。
        assert.equal(target.capabilities.pos, false);
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
