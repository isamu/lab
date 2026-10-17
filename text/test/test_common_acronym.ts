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

    it("一般の読み手が読む略語（DOI、ISO、UTC、SMS）は載せ、分野の略語と機関の名前（RFC、IANA、NASA）は載せない", () => {
      ["DOI", "ISBN", "ISSN", "ISO", "UTC", "GDP", "SMS", "FAX", "DVD", "DIY", "HIV", "UV"].forEach((word) => assert.ok(common.includes(word), word));
      ["RFC", "IANA", "NIST", "GSA", "NASA"].forEach((word) => assert.ok(!common.includes(word), word));
    });

    it("ブラウザの名前 IE は、版の番号が付いても並べて書いても指摘しない。IE で始まる別の略語（IEEE）は指摘する", () => {
      const source =
        adapter.id === "ja"
          ? `# T\n\n${pending} 動作の確認: IE/Edge/Firefox/Chrome。IE11 でも IE で表示する。IEEE の規格に従う。\n`
          : `# T\n\n${pending} Check it in IE/Edge/Firefox/Chrome. It must work in IE11 and IE, i.e. the old browser. It follows an IEEE standard.\n`;
      const found = reported(adapter, source);
      assert.ok(!found.includes("IE"), found.join(","));
      assert.ok(found.includes("IEEE"), found.join(","));
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
