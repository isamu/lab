import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { excerptsAround } from "../packages/chaff/src/feedback/excerpt.ts";
import { feedbackDraft, type FeedbackInput } from "../packages/chaff/src/feedback/draft.ts";
import { FEEDBACK_FILE, runFeedback, type Checked, type FeedbackContext } from "../packages/chaff/src/commands/feedback.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

const DOC = Array.from({ length: 12 }, (_, index) => `line ${String(index + 1)}`).join("\n");

describe("報告に載せる、文書の前後の行", () => {
  it("前後 2 行ずつ、重なりと隣り合いはまとめる", () => {
    assert.deepEqual(
      excerptsAround(DOC, [5, 6, 11]).map(({ from, to }) => [from, to]),
      [[3, 12]],
    );
    assert.deepEqual(excerptsAround(DOC, [2, 9]), [
      { from: 1, to: 4, lines: ["line 1", "line 2", "line 3", "line 4"] },
      { from: 7, to: 11, lines: ["line 7", "line 8", "line 9", "line 10", "line 11"] },
    ]);
  });

  it("文書の端では切り詰める", () => {
    assert.deepEqual(excerptsAround(DOC, [1]), [{ from: 1, to: 3, lines: ["line 1", "line 2", "line 3"] }]);
  });

  it("文書の外の行と重複は捨て、順に並べる", () => {
    assert.deepEqual(
      excerptsAround(DOC, [0, 99, 12, 12]).map(({ from, to }) => [from, to]),
      [[10, 12]],
    );
  });

  it("空の文書", () => {
    assert.deepEqual(excerptsAround("", [1]), [{ from: 1, to: 1, lines: [""] }]);
  });
});

const input = (overrides: Partial<FeedbackInput> = {}): FeedbackInput => ({
  kind: "false-positive",
  version: "0.8.0",
  runtime: "Node v24 · linux x64",
  fileName: "a.md",
  language: "ja",
  genre: "blog/tech",
  findings: [{ rule: "max-sentence-length", line: 5, message: "この文は 102 文字あります（100 文字まで）" }],
  excerpts: excerptsAround(DOC, [5]),
  config: undefined,
  ...overrides,
});

describe("報告の下書き", () => {
  it("誤検出: 題に rule と文言、本文に環境・指摘・前後の行・期待すること", () => {
    const draft = feedbackDraft(input(), "ja");
    assert.equal(draft.title, "誤検出: max-sentence-length — この文は 102 文字あります（100 文字まで）");
    ["chaffjs 0.8.0", "a.md · ja · blog/tech", "`max-sentence-length` (5)", "3〜7 行目", "line 7", "## 期待すること"].forEach((part) =>
      assert.ok(draft.body.includes(part), part),
    );
    assert.ok(!draft.body.includes("line 8"));
    assert.ok(!draft.body.includes("chaff.yaml"));
  });

  it("見逃し: 題にファイルと行", () => {
    assert.equal(feedbackDraft(input({ kind: "missed", findings: [] }), "en").title, "Missed: a.md line 3");
  });

  it("chaff.yaml があれば載せる", () => {
    assert.match(feedbackDraft(input({ config: "genre: blog/tech\n" }), "en").body, /## chaff\.yaml\n\n```yaml\ngenre: blog\/tech\n```/u);
  });

  it("文書の中の ``` で囲いが壊れない", () => {
    const body = feedbackDraft(input({ excerpts: [{ from: 1, to: 1, lines: ["```js"] }] }), "en").body;
    assert.match(body, /````\n```js\n````/u);
  });
});

describe("chaff feedback", () => {
  const rules = loadRules("ja");
  const finding = (rule: string, line: number): Finding => ({ rule, severity: "warning", line, column: 1, quote: "", values: { length: 102, limit: 100 } });
  const run = async (argv: readonly string[], findings: readonly Finding[] = [finding("max-sentence-length", 5)]) => {
    const cwd = mkdtempSync(join(tmpdir(), "chaff-feedback-"));
    writeFileSync(join(cwd, "a.md"), DOC);
    const out: string[] = [];
    const saved = { log: console.log, error: console.error };
    console.log = (...parts: unknown[]) => {
      out.push(parts.join(" "));
    };
    console.error = console.log;
    const checked: Checked = { findings, rules, language: "ja", genre: "blog/tech" };
    const context: FeedbackContext = {
      cwd,
      ui: "en",
      version: "0.8.0",
      runtime: "Node",
      flag: (args, name) => {
        const at = args.indexOf(name);
        return at === -1 ? undefined : args[at + 1];
      },
      check: () => Promise.resolve(checked),
    };
    try {
      const targets = argv.filter((arg, index) => !arg.startsWith("--") && !["--rule", "--line"].includes(argv[index - 1] ?? ""));
      const code = await runFeedback(
        targets.map((target) => join(cwd, target)),
        argv,
        context,
      );
      return { code, out: out.join("\n"), cwd };
    } finally {
      console.log = saved.log;
      console.error = saved.error;
    }
  };

  it("下書きを書き、送り方を示すが、何も送らない", async () => {
    const result = await run(["a.md", "--rule", "max-sentence-length"]);
    assert.equal(result.code, 0);
    assert.ok(existsSync(join(result.cwd, FEEDBACK_FILE)));
    assert.match(readFileSync(join(result.cwd, FEEDBACK_FILE), "utf8"), /line 5/u);
    assert.match(result.out, /gh issue create -R isamu\/lab --title "False positive: max-sentence-length/u);
    assert.match(result.out, /https:\/\/github\.com\/isamu\/lab\/issues\/new\?title=/u);
    assert.match(result.out, /has not sent anything/u);
  });

  it("見逃しは --line が要る", async () => {
    assert.equal((await run(["a.md", "--missed"])).code, 1);
    assert.equal((await run(["a.md", "--missed", "--line", "4"], [])).code, 0);
  });

  it("誤検出は --rule か --line で選ぶ。無ければ使い方", async () => {
    assert.equal((await run(["a.md"])).code, 1);
  });

  it("選んだ指摘が無ければ、この文書の指摘を並べて断る", async () => {
    const result = await run(["a.md", "--rule", "heading-echo"]);
    assert.equal(result.code, 1);
    assert.match(result.out, /5 {2}max-sentence-length/u);
  });

  it("行番号でないものは断る", async () => {
    const result = await run(["a.md", "--line", "x"]);
    assert.equal(result.code, 1);
    assert.match(result.out, /^usage: chaff feedback/u);
  });

  it("無いファイルは断る", async () => {
    assert.equal((await run(["missing.md", "--rule", "max-sentence-length"])).code, 1);
  });
});
