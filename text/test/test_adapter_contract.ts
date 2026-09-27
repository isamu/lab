import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isAbsent, loadAdapter, packageFor, packagesFor } from "../packages/chaff/src/adapter-load.ts";

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

  it("同梱していない言語は @chaffjs/lang-<言語> を探す", () => {
    // 利用者が lang-zh を書いて入れれば、core を変えずにその言語で動く。
    assert.equal(packageFor("zh"), "@chaffjs/lang-zh");
    assert.equal(packageFor("ko"), "@chaffjs/lang-ko");
  });

  it("言語の名前として読めないものには、パッケージを探さない", () => {
    ["", "../ja", "JA", "chinese", "zh-TW"].forEach((language) => assert.equal(packageFor(language), undefined, language));
  });

  it("入っていない言語は、探した名前と入れ方を添えて断る", async () => {
    await assert.rejects(loadAdapter("xq"), /No package for language xq is installed \(@chaffjs\/lang-xq or chaff-lang-xq; npm i -D @chaffjs\/lang-xq\)/u);
  });

  it("探す順は、公式の @chaffjs/lang-<言語>、次に第三者の chaff-lang-<言語>。同梱の言語は表のものだけ", () => {
    assert.deepEqual(packagesFor("zh"), ["@chaffjs/lang-zh", "chaff-lang-zh"]);
    assert.deepEqual(packagesFor("ja"), ["@chaffjs/lang-ja"]);
    assert.deepEqual(packagesFor("en"), ["@chaffjs/lang-en"]);
    ["", "../ja", "JA", "chinese", "zh-TW"].forEach((language) => assert.deepEqual(packagesFor(language), [], language));
  });

  const notFound = (specifier: string): Error => Object.assign(new Error(`Cannot find package '${specifier}'`), { code: "ERR_MODULE_NOT_FOUND" });
  const fakeImporter =
    (installed: Readonly<Record<string, unknown>>, tried: string[]) =>
    (specifier: string): Promise<unknown> => {
      tried.push(specifier);
      return specifier in installed ? Promise.resolve(installed[specifier]) : Promise.reject(notFound(specifier));
    };

  it("公式が無ければ chaff-lang-<言語> を読む", async () => {
    const tried: string[] = [];
    const adapter = await loadAdapter("zh", fakeImporter({ "chaff-lang-zh": { adapter: { ...ja, id: "zh" } } }, tried));
    assert.equal(adapter.id, "zh");
    assert.deepEqual(tried, ["@chaffjs/lang-zh", "chaff-lang-zh"]);
  });

  it("公式があれば第三者は見ない", async () => {
    const tried: string[] = [];
    await loadAdapter("zh", fakeImporter({ "@chaffjs/lang-zh": { default: { ...ja, id: "zh" } }, "chaff-lang-zh": {} }, tried));
    assert.deepEqual(tried, ["@chaffjs/lang-zh"]);
  });

  it("入っていて壊れている公式は、第三者に逃げずにそのまま失敗する", async () => {
    const tried: string[] = [];
    const broken = (specifier: string): Promise<unknown> => {
      tried.push(specifier);
      return Promise.reject(new SyntaxError("Unexpected token"));
    };
    await assert.rejects(loadAdapter("zh", broken), SyntaxError);
    assert.deepEqual(tried, ["@chaffjs/lang-zh"]);
  });

  it("入っている公式が依存を見つけられないときは、入っていないことにせず、そのまま失敗する", async () => {
    const tried: string[] = [];
    const depMissing = (specifier: string): Promise<unknown> => {
      tried.push(specifier);
      return Promise.reject(notFound("wink-pos-tagger"));
    };
    await assert.rejects(loadAdapter("zh", depMissing), /Cannot find package 'wink-pos-tagger'/u);
    assert.deepEqual(tried, ["@chaffjs/lang-zh"]);
  });

  it("最後の候補が依存を見つけられないときも、「入っていない」ではなく元の失敗を出す", async () => {
    const importer = (specifier: string): Promise<unknown> => Promise.reject(specifier === "chaff-lang-zh" ? notFound("some-dependency") : notFound(specifier));
    await assert.rejects(loadAdapter("zh", importer), /Cannot find package 'some-dependency'/u);
  });

  it("入っていないかどうかは、探した名前が文言にあるかで決める", () => {
    assert.equal(isAbsent(notFound("@chaffjs/lang-zh"), "@chaffjs/lang-zh"), true);
    assert.equal(isAbsent(notFound("wink-pos-tagger"), "@chaffjs/lang-zh"), false);
    assert.equal(isAbsent(new Error("Cannot find package '@chaffjs/lang-zh'"), "@chaffjs/lang-zh"), false);
    assert.equal(isAbsent("x", "@chaffjs/lang-zh"), false);
  });

  it("第三者のものも、LanguageAdapter の形でなければ断る", async () => {
    await assert.rejects(
      loadAdapter("zh", fakeImporter({ "chaff-lang-zh": { default: { kind: "language" } } }, [])),
      /chaff-lang-zh does not export a LanguageAdapter/u,
    );
  });
});
