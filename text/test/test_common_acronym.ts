import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 説明なしで通じる略語は、言語パッケージの語彙表 common-acronym が持つ。例文はすべて自作。

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

// 上限に届かせるための、説明の無い略語。
const PENDING = { en: "SRE, XYZ and CBA are pending.", ja: "SRE、XYZ、CBAは保留。" };

[en, ja].forEach((adapter) => {
  const pending = adapter.id === "ja" ? PENDING.ja : PENDING.en;
  const common = (adapter.lexicons["common-acronym"] ?? []).map((entry) => entry.pattern);

  describe(`common-acronym（${adapter.id}）`, () => {
    it("語彙表がある", () => {
      assert.ok(common.includes("API"));
      assert.ok(
        common.every((word) => /^[A-Z]+(?:&[A-Z]+)*$/u.test(word)),
        "どの語も大文字だけの文字列（& で繋いでもよい）として読める",
      );
    });

    it("一般の読み手が読む略語（DOI、ISO、UTC、SMS）は載せ、分野の略語（RFC、IANA、NIST）は載せない", () => {
      ["DOI", "ISBN", "ISSN", "ISO", "UTC", "GDP", "NASA", "SMS"].forEach((word) => assert.ok(common.includes(word), word));
      ["RFC", "IANA", "NIST", "GSA"].forEach((word) => assert.ok(!common.includes(word), word));
    });

    it("語彙表のどの語も指摘しない。載っていない略語は指摘する", () => {
      common.forEach((word) => {
        const usage = adapter.id === "ja" ? word + "を使う。" : "We use " + word + " here.";
        const found = reported(adapter, `# T\n\n${pending} ${usage}\n`);
        assert.ok(!found.includes(word), word);
        assert.ok(found.includes("SRE"), `${word} の文書でも SRE は指摘する`);
      });
    });
  });
});

describe("common-acronym の無い言語", () => {
  it("rule は動かず、語彙表が無いと理由を言う（通じる略語まで指摘しない）", () => {
    const bare: LanguageAdapter = { ...en, lexicons: {} };
    const result = runRules(buildDocument("t.md", `# T\n\n${PENDING.en} We use API here.\n`, bare), loadRules("en"), {}, true, "business/report");
    assert.ok(!result.findings.some((finding) => finding.rule === "undefined-acronym"));
    const skipped = result.skipped.find((entry) => entry.rule === "undefined-acronym");
    assert.ok(skipped?.why.includes("common-acronym"));
  });
});
