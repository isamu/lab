import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// All text here is self-written.
const matchedFor = (source: string, adapter: LanguageAdapter = ja, genre = "blog/tech"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "closing-cliche")
    .map((finding) => String(finding.values?.["matched"] ?? ""));

const flagged = (source: string, adapter: LanguageAdapter = ja, genre = "blog/tech"): boolean => matchedFor(source, adapter, genre).length > 0;

describe("closing-cliche: 最後の段落でだけ定型になる言い回し", () => {
  it("invalid: 読み手への「〜てみてほしい」で締める", () => {
    assert.ok(flagged("# 散歩\n\n朝に歩くようになった。\n\n景色が変わって見えた。\n\nもし時間があるなら、一度歩いてみてほしい。\n", ja, "blog/essay"));
  });

  it("valid: 本文の途中の「〜てみてほしい」は勧めで、結びではない", () => {
    const body = "# 散歩\n\n## 道\n\nこの坂は一度歩いてみてほしい。\n\n坂の上に古い寺がある。\n\n寺の裏に川が流れている。\n\n川沿いを駅まで戻った。\n";
    assert.ok(!flagged(body, ja, "blog/essay"));
  });

  it("invalid: 「楽しんでください！」「〜ましょう！」で締める", () => {
    assert.ok(flagged("# 手順\n\n設定を保存します。\n\nこれで準備は終わりです。新しい机、楽しんでください！\n"));
    assert.ok(flagged("# 手順\n\n設定を保存します。\n\n## まとめ\n\n毎朝、最初に予定を確かめる習慣をつけましょう！\n"));
  });

  it("valid: 最後の段落の具体的な指示は結びの定型ではない", () => {
    assert.ok(!flagged("# 手順\n\n設定を保存します。\n\n## まとめ\n\n落ちたテストは、まず落ちた時刻を並べてみてください。\n"));
    assert.ok(!flagged("# 手順\n\n設定を保存します。\n\n## まとめ\n\n保存の前に、必ず差分を確かめましょう。\n"));
  });
});

describe("closing-cliche: 前の語と文の終わりの語の組", () => {
  it("invalid: 「気軽に〜ください」で締める", () => {
    assert.ok(
      flagged(
        "# 保存のしかた\n\n冷凍すれば一か月もちます。\n\n## さいごに\n\nわからないことがあれば、店の者に気軽に声をかけてください。\n",
        ja,
        "blog/owned-media",
      ),
    );
  });

  it("valid: 「気軽に」があっても頼む文で終わらなければ指さない", () => {
    assert.ok(
      !flagged("# 保存のしかた\n\n冷凍すれば一か月もちます。\n\n## さいごに\n\n冷凍庫に入れておけば、気軽に一切れずつ焼けます。\n", ja, "blog/owned-media"),
    );
  });
});

describe("closing-cliche: 語彙の広げ方", () => {
  it("invalid: 「参考になればうれしいです」も「参考になれば幸いです」と同じ結び", () => {
    assert.ok(flagged("# 設定\n\n手順は三つです。\n\n同じことで困っている方の参考になればうれしいです。\n"));
  });

  it("「参考になれば幸いです」は今までどおりその語で言う", () => {
    assert.deepEqual(matchedFor("# 設定\n\n手順は三つです。\n\n誰かの参考になれば幸いです。\n"), ["参考になれば幸いです"]);
  });
});

describe("closing-cliche: English closings", () => {
  it("invalid: a two-word sign-off such as Happy brewing!", () => {
    assert.deepEqual(matchedFor("# Brewing\n\nGrind the beans fresh.\n\nAsk us at the counter.\n\nHappy brewing!\n", en, "blog/owned-media"), [
      "Happy brewing!",
    ]);
  });

  it("valid: a sentence that only opens with Happy is not a sign-off", () => {
    assert.ok(!flagged("# Brewing\n\nGrind the beans fresh.\n\nHappy customers come back for the second bag!\n", en, "blog/owned-media"));
  });

  it("valid: a sign-off line before the last paragraph is not the closing line", () => {
    const body =
      "# Notes\n\n## Week one\n\nHappy brewing!\n\nWe moved the roaster on Monday.\n\nThe new one heats faster.\n\nIt cut our roast time by four minutes.\n\nWe will report the second week next.\n";
    assert.ok(!flagged(body, en));
  });

  it("invalid: Your future self will thank you", () => {
    assert.ok(flagged("# Backups\n\nCopy the photos to a drive.\n\n## Final thoughts\n\nStart today. Your future self will thank you.\n", en));
  });

  it("invalid: ends on 'and go from there'", () => {
    assert.ok(flagged("# Formulas\n\nSUMIF adds the matching rows.\n\nPick one formula, try it on a copy, and go from there.\n", en));
  });

  it("valid: 'go from there' in the body is an ordinary phrase", () => {
    const body =
      "# Formulas\n\n## Start\n\nWe checked the totals and went from there.\n\nWe will go from there to the second sheet.\n\nThe second sheet holds the costs.\n\nThe third sheet holds the dates.\n\nThe fourth sheet holds the names.\n\nThe totals now match.\n";
    assert.ok(!flagged(body, en));
  });
});
