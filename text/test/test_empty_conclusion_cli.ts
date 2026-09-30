import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./cli-run.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";

// chaff test --dry-run が、結びの日付を数量と見分けてから送るものを決める。
// 機械の検査をすべて切るので、品詞の解析器を読み込むのは chaff test だけになる。このファイルは他の検査と同じ process で動かさない。

const MACHINE_OFF = ["rules:", ...loadRules("ja").flatMap((rule) => (rule.layer === "L4" ? [] : [`  ${rule.id}: off`]))].join("\n");

const dryRun = async (source: string): Promise<string> => {
  const run = await runCli({ "chaff.yaml": `${MACHINE_OFF}\n`, "a.md": source }, ["test", "a.md", "--dry-run", "--genre", "business/report"]);
  return run.out;
};

describe("chaff test --dry-run: empty-conclusion", () => {
  it("本文の数量と同じ数でも、結びの新しい日付は具体物なので送らない", async () => {
    assert.match(await dryRun("# 報告\n\n未回答は 9 件でした。\n\n## まとめ\n\n9月末までに回答します。\n"), /0 箇所 {2}結びに中身がない/u);
  });

  it("本文を繰り返すだけの結びは送り、送る文章を出す", async () => {
    const out = await dryRun("# 9月の報告\n\n9月の問い合わせは 412 件でした。\n\n## まとめ\n\n以上のように、9月は問い合わせが増えました。\n");
    assert.match(out, /1 箇所 {2}結びに中身がない/u);
    assert.match(out, /以上のように、9月は問い合わせが増えました。/u);
  });
});
