import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { planSemantic } from "../packages/chaff/src/run-semantic.ts";
import { renderPlan } from "../packages/chaff/src/render/semantic.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { UserCheck } from "../packages/chaff/src/checks.ts";

const SOURCE = ["# 週次報告", "", "売上が前年から20%向上しました。担当者にご確認ください。", "コストを15%削減できました。期限までにお願いします。"].join("\n");

const check = (name: string, lookAt: string | undefined): UserCheck => ({
  id: `check:${name}`,
  name,
  use_for: ["business"],
  check: "見てほしいこと",
  look_at: lookAt,
  level: "normal",
  how_to_fix: "直しかた",
  source: "checks.yaml",
});

describe("chaff test --dry-run", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const doc = buildDocument("t.md", SOURCE, ja);
  const checks = [check("依頼には期限と担当がある", "「お願いします」「ご確認ください」を含む文"), check("議事録に決定事項がある", undefined)];
  const jobs = planSemantic(doc, loadRules("ja"), checks, {}, "business/report");

  it("送る先を決めるところまでで、API を呼ばない", () => {
    // planSemantic は非同期ですらない。呼ぶ経路が無いことが型で分かる。
    assert.ok(jobs.length > 0);
  });

  it("絞り込めた検査は、その語を含む文だけを送る", () => {
    const narrowed = jobs.find((job) => job.name === "依頼には期限と担当がある");
    assert.equal(narrowed?.candidates.length, 2);
    assert.deepEqual(narrowed?.narrowing?.words, ["お願いします", "ご確認ください"]);
  });

  it("絞り込めない検査は全文 1 件になる", () => {
    const whole = jobs.find((job) => job.name === "議事録に決定事項がある");
    assert.equal(whole?.candidates.length, 1);
    assert.deepEqual(whole?.narrowing?.words, []);
  });

  it("何箇所送るかと、絞り込みかたを出す", () => {
    const text = renderPlan("t.md", jobs, doc.sentences.length).join("\n");
    assert.match(text, /API は呼んでいません/u);
    assert.match(text, /「お願いします」/u);
    assert.match(text, /絞り込めず全文/u);
  });
});
