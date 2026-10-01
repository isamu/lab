import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const idsFor = (source: string, adapter: LanguageAdapter = ja): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, "blog/tech").findings.map((finding) => finding.rule);

describe("L2 の語彙表", () => {
  it("日本語と英語の両方が同じ id の語彙表を持つ", () => {
    // 語彙表だけが言語別で、rule は共通。ここが崩れると四層モデルが成立しない。
    ["empty-intensifier", "padded-intro", "closing-cliche"].forEach((id) => {
      assert.ok(ja.lexicons[id] !== undefined, `ja に ${id} が無い`);
      assert.ok(en.lexicons[id] !== undefined, `en に ${id} が無い`);
    });
  });

  it("語彙表が空でない", () => {
    Object.entries(ja.lexicons).forEach(([id, entries]) => assert.ok(entries.length > 0, `${id} が空`));
  });
});

describe("empty-intensifier", () => {
  it("invalid: 空虚な強調を指摘する", () => {
    assert.ok(idsFor("この機能は非常に重要です。").includes("empty-intensifier"));
  });

  it("valid: 中身のある強調は指摘しない", () => {
    // 誤検知しやすい正常な文章。「重要」という語そのものは禁じていない。
    assert.ok(!idsFor("課金額に直結するため、この値の検証は重要です。").includes("empty-intensifier"));
  });

  it("英語でも同じ rule が動く", () => {
    assert.ok(idsFor("It is important to note that the cache expires.", en).includes("empty-intensifier"));
  });
});

describe("padded-intro", () => {
  it("invalid: 冒頭の水増しを指摘する", () => {
    assert.ok(idsFor("近年、AIの活用が注目されています。本題です。").includes("padded-intro"));
  });

  it("valid: 本文の途中の同じ語は指摘しない", () => {
    // 誤検知しやすい正常な文章。「近年」は書き出しでなければ普通の語。
    const body = "キャッシュの話をします。TTL を短くします。整合性が保てます。負荷は上がります。近年のハードウェアなら問題ありません。";
    assert.ok(!idsFor(body).includes("padded-intro"));
  });

  it("英語でも同じ rule が動く", () => {
    assert.ok(idsFor("In today's fast-paced world, teams ship faster.", en).includes("padded-intro"));
  });
});

describe("closing-cliche", () => {
  it("invalid: 定型の結びを指摘する", () => {
    assert.ok(idsFor("# 題\n\n本文です。\n\n## まとめ\n\nいかがでしたか。").includes("closing-cliche"));
  });

  it("valid: 最後の節でなければ指摘しない", () => {
    // 誤検知しやすい正常な文章。途中の「まとめると」は普通の接続。
    const body = "# 題\n\n## 一\n\nまとめると、こうなります。\n\n## 二\n\n次の話をします。";
    assert.ok(!idsFor(body).includes("closing-cliche"));
  });

  it("valid: 結びが具体的なら指摘しない", () => {
    assert.ok(!idsFor("# 題\n\n本文です。\n\n## まとめ\n\nTTL は実測してから決めてください。").includes("closing-cliche"));
  });

  // #413 の再現（自作の文）。見出しの無い文書は本文全体が最後の節なので、節だけで切ると冒頭まで結びになる。
  it("valid: 見出しの無い文書の冒頭の「まとめると」は結びではない", () => {
    const body =
      "# 試し\n\nとても重要な教訓があります。簡単にまとめると、以下の三点です。\n\n一つ目の点です。二つ目の点です。三つ目の点です。\n\nここから別の話を始めます。この段落には中身があります。\n\n最後の段落です。具体的な話で終わります。\n";
    assert.ok(!idsFor(body).includes("closing-cliche"));
  });

  it("valid: 長い最後の節の途中の「いかがでしょうか」は結びではない", () => {
    const body = "# 題\n\n## 一\n\n本文です。\n\n## 二\n\n手で作ってみるのはいかがでしょうか。\n\n次に、設定を一行変えます。ビルドが速くなりました。\n";
    assert.ok(!idsFor(body).includes("closing-cliche"));
  });

  it("invalid: 見出しの無い文書でも、最後の段落の決まり文句は結び", () => {
    assert.ok(idsFor("# 題\n\n本文です。\n\n次の段落です。\n\nいかがでしたか。\n").includes("closing-cliche"));
    assert.ok(idsFor("本文です。\n\n参考になれば幸いです。\n").includes("closing-cliche"));
  });

  it("valid: 最後の節が箇条書きで終われば、その前の段落が結び。箇条書きの中は結びに数えない", () => {
    assert.ok(idsFor("# 題\n\n## まとめ\n\nいかがでしたか。\n\n- 参考になれば幸いです\n").includes("closing-cliche"));
    assert.ok(!idsFor("# 題\n\n## まとめ\n\n- 参考になれば幸いです\n").includes("closing-cliche"));
  });
});

describe("語彙表が無い言語", () => {
  it("黙って通さず、動かなかったと報告する", () => {
    const bare: LanguageAdapter = { ...ja, lexicons: {} };
    const result = runRules(buildDocument("t.md", "この機能は非常に重要です。", bare), loadRules("ja"), {}, false, "blog/tech");
    assert.equal(result.findings.length, 0);
    assert.ok(
      result.skipped.some((entry) => entry.rule === "empty-intensifier"),
      JSON.stringify(result.skipped),
    );
  });
});
