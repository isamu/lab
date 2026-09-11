import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { emptyConclusion, riskDisclosure, unsourcedNumber, wholeDocument } from "../packages/chaff/src/semantic.ts";
import { loadChecks, severityOf } from "../packages/chaff/src/checks.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const doc = (source: string) => buildDocument("t.md", source, ja);

describe("絞り込み: risk-disclosure", () => {
  it("リスクの見出しがあれば、そもそも問い合わせない", () => {
    // 見出しに答えが書いてあるなら本文を読ませる必要はない。ここが効かないと毎回課金される。
    assert.deepEqual(riskDisclosure(doc("# 提案\n\n施策の話です。\n\n## リスク\n\n失敗すると困ります。")), []);
  });

  it("リスクの見出しが無ければ、本文を候補にする", () => {
    assert.equal(riskDisclosure(doc("# 提案\n\n施策の話です。効果があります。")).length, 1);
  });

  it("英語の見出しでも効く", () => {
    assert.deepEqual(riskDisclosure(doc("# Proposal\n\nWe should do this.\n\n## Risk\n\nIt may fail.")), []);
  });

  it("空文書では候補が無い", () => {
    assert.deepEqual(riskDisclosure(doc("")), []);
  });
});

describe("絞り込み: empty-conclusion", () => {
  it("最後の節に具体物が無ければ候補にする", () => {
    assert.equal(emptyConclusion(doc("# 題\n\n本文です。\n\n## まとめ\n\n以上のとおりです。")).length, 1);
  });

  it("数字があれば問い合わせない", () => {
    // 誤検知しやすい正常な文章。具体が入っている結びを疑わない。
    assert.deepEqual(emptyConclusion(doc("# 題\n\n本文です。\n\n## まとめ\n\nTTL は 3600 秒にしてください。")), []);
  });

  it("コードがあれば問い合わせない", () => {
    assert.deepEqual(emptyConclusion(doc("# 題\n\n本文。\n\n## まとめ\n\n`chaff lint` を回してください。")), []);
  });
});

describe("絞り込み: unsourced-number", () => {
  it("効果を主張する数字だけを候補にする", () => {
    const found = unsourcedNumber(doc("導入により工数が 40% 削減されます。"));
    assert.equal(found.length, 1);
  });

  it("根拠が添えてあれば候補にしない", () => {
    assert.deepEqual(unsourcedNumber(doc("導入により工数が 40% 削減されました（2026年4-6月、対前年同期）。")), []);
  });

  it("効果を言っていない数字は候補にしない", () => {
    // 誤検知しやすい正常な文章。仕様値まで疑うと、技術文書が全部引っかかる。
    assert.deepEqual(unsourcedNumber(doc("TTL は 3600 秒です。ポートは 8080 番を使います。")), []);
  });

  it("数字だけ、効果だけでは候補にしない", () => {
    assert.deepEqual(unsourcedNumber(doc("処理を改善しました。")), []);
    assert.deepEqual(unsourcedNumber(doc("件数は 120 件です。")), []);
  });
});

describe("絞り込み: whole-document", () => {
  it("本文があれば 1 候補にまとめる", () => {
    assert.equal(wholeDocument(doc("一文目です。二文目です。")).length, 1);
  });

  it("空なら候補にしない", () => {
    assert.deepEqual(wholeDocument(doc("")), []);
  });
});

describe("checks.yaml", () => {
  const write = (body: string): string => {
    const path = join(mkdtempSync(join(tmpdir(), "chaff-")), "checks.yaml");
    writeFileSync(path, body, "utf8");
    return path;
  };

  it("自然文の検査を読み込む", () => {
    const path = write(
      [
        "checks:",
        "  - name: 数字には根拠がある",
        "    use_for: business",
        "    check: |",
        "      効果を主張する数値に根拠があること。",
        "    level: strict",
        "    how_to_fix: 括弧で添えてください。",
      ].join("\n"),
    );
    const [check] = loadChecks(path);
    assert.equal(check?.name, "数字には根拠がある");
    assert.deepEqual(check?.use_for, ["business"]);
    assert.equal(check?.level, "strict");
    assert.match(check?.check ?? "", /効果を主張する数値/u);
  });

  it("id を名前から作る。利用者に id を書かせない", () => {
    assert.equal(loadChecks(write("checks:\n  - name: Risk is stated\n    check: あること\n"))[0]?.id, "check:risk-is-stated");
  });

  it("name か check が欠けた項目は落とす", () => {
    assert.deepEqual(loadChecks(write("checks:\n  - name: 名前だけ\n  - check: 中身だけ\n")), []);
  });

  it("ファイルが無ければ空", () => {
    assert.deepEqual(loadChecks("/nowhere/checks.yaml"), []);
  });

  it("4 語が深刻度になる", () => {
    assert.equal(severityOf("strict"), "error");
    assert.equal(severityOf("normal"), "warning");
    assert.equal(severityOf("relaxed"), "info");
  });
});

describe("L4 の rule 定義", () => {
  const l4 = loadRules("ja").filter((rule) => rule.layer === "L4");

  it("3 本ある", () => {
    assert.equal(l4.length, 3);
  });

  it("すべて what_to_check を持つ", () => {
    // 絞り込みを持たない L4 rule は登録できない、と同じ理由。決まりが無ければ判定できない。
    l4.forEach((rule) => assert.ok((rule.what_to_check?.["ja"] ?? "").length > 0, `${rule.id}: what_to_check.ja`));
  });

  it("severity を段で持つ", () => {
    l4.forEach((rule) => assert.ok(rule.levels.normal !== undefined, `${rule.id}: levels.normal`));
  });
});
