import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { excerptsAround } from "../packages/chaff/src/feedback/excerpt.ts";
import { feedbackDraft, type FeedbackInput } from "../packages/chaff/src/feedback/draft.ts";
import {
  FEEDBACK_FILE,
  MAX_TITLE_LENGTH,
  runFeedback,
  settingsOf,
  shellQuoted,
  titleLine,
  type Checked,
  type FeedbackContext,
} from "../packages/chaff/src/commands/feedback.ts";
import { execFileSync } from "node:child_process";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";
import type { Skipped } from "../packages/chaff/src/run.ts";
import type { Config } from "../packages/chaff/src/config/load.ts";

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
  conditions: [],
  findings: [{ rule: "max-sentence-length", line: 5, message: "この文は 102 文字あります（100 文字まで）" }],
  line: 5,
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
    // The reported line, not the first line of the excerpt around it.
    assert.equal(feedbackDraft(input({ kind: "missed", findings: [], line: 5 }), "en").title, "Missed: a.md line 5");
  });

  it("実行の条件があれば環境に書き、無ければ書かない", () => {
    assert.match(
      feedbackDraft(input({ conditions: ["--experimental", "--genre business/report"] }), "en").body,
      /^- Run with: --experimental --genre business\/report$/mu,
    );
    assert.match(feedbackDraft(input({ conditions: ["--experimental"] }), "ja").body, /^- 実行の条件: --experimental$/mu);
    assert.doesNotMatch(feedbackDraft(input(), "en").body, /Run with/u);
  });

  it("chaff.yaml があれば載せる", () => {
    assert.match(feedbackDraft(input({ config: "genre: blog/tech\n" }), "en").body, /## chaff\.yaml\n\n```yaml\ngenre: blog\/tech\n```/u);
  });

  it("文書の中の ``` で囲いが壊れない", () => {
    const body = feedbackDraft(input({ excerpts: [{ from: 1, to: 1, lines: ["```js"] }] }), "en").body;
    assert.match(body, /````\n```js\n````/u);
  });
});

describe("chaff.yaml から載せる設定", () => {
  it("報告する rule の行だけ。数の上限は段階より先", () => {
    const config: Pick<Config, "rules" | "limits"> = {
      rules: { "max-sentence-length": "normal", "bold-density": "off" },
      limits: { "max-sentence-length": 260 },
    };
    assert.equal(settingsOf(config, ["max-sentence-length", "max-sentence-length"]), "rules:\n  max-sentence-length: 260");
    assert.equal(settingsOf(config, ["bold-density"]), "rules:\n  bold-density: off");
    assert.equal(settingsOf(config, ["heading-echo"]), undefined);
  });
});

describe("送り方の表示", () => {
  it("題は一行に、長ければ切り詰める", () => {
    assert.equal(titleLine("a\n b\tc"), "a b c");
    const long = titleLine("x".repeat(500));
    assert.equal(long.length, MAX_TITLE_LENGTH);
    assert.ok(long.endsWith("…"));
  });

  // Windows には /bin/sh が無い。題の引用符は POSIX のシェル向けなので、確かめられるのはそこだけ。
  it("シェルに渡す題は、何を含んでもそのまま読まれる", { skip: process.platform === "win32" ? "no /bin/sh on Windows" : false }, () => {
    const titles = ["plain", "it's", "$(touch /tmp/pwned)", "`id`", '"quoted" $HOME \\ back', "'''"];
    titles.forEach((title) => {
      assert.equal(execFileSync("/bin/sh", ["-c", `printf %s ${shellQuoted(title)}`], { encoding: "utf8" }), title);
    });
  });
});

describe("chaff feedback", () => {
  const rules = loadRules("ja");
  const finding = (rule: string, line: number): Finding => ({ rule, severity: "warning", line, column: 1, quote: "", values: { length: 102, limit: 100 } });
  const run = async (argv: readonly string[], findings: readonly Finding[] = [finding("max-sentence-length", 5)], skipped: readonly Skipped[] = []) => {
    const cwd = mkdtempSync(join(tmpdir(), "chaff-feedback-"));
    writeFileSync(join(cwd, "a.md"), DOC);
    writeFileSync(join(cwd, "chaff.yaml"), "jargon:\n  - 社外秘の語\nrules:\n  max-sentence-length: relaxed\n");
    const out: string[] = [];
    const saved = { log: console.log, error: console.error };
    console.log = (...parts: unknown[]) => {
      out.push(parts.join(" "));
    };
    console.error = console.log;
    const checked: Checked = { findings, rules, language: "ja", genre: "blog/tech", skipped, conditions: [] };
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
      settingsOf: (ids) => (ids.includes("max-sentence-length") ? "rules:\n  max-sentence-length: relaxed" : undefined),
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
    assert.match(result.out, /gh issue create -R isamu\/lab --title 'False positive: max-sentence-length/u);
    assert.match(result.out, /https:\/\/github\.com\/isamu\/lab\/issues\/new\?title=/u);
    // The link carries the title only: document lines never go into a URL.
    assert.doesNotMatch(result.out, /&body=/u);
    const draft = readFileSync(join(result.cwd, FEEDBACK_FILE), "utf8");
    assert.match(draft, /max-sentence-length: relaxed/u);
    assert.doesNotMatch(draft, /社外秘の語/u);
    assert.match(result.out, /has not sent anything/u);
  });

  it("--with-config を付けたときだけ chaff.yaml 全体を載せる", async () => {
    const result = await run(["a.md", "--rule", "max-sentence-length", "--with-config"]);
    assert.match(readFileSync(join(result.cwd, FEEDBACK_FILE), "utf8"), /社外秘の語/u);
  });

  it("一つの rule の指摘がいくつもあれば、--line で一つ選ばせる", async () => {
    const several = [finding("max-sentence-length", 2), finding("max-sentence-length", 9)];
    const result = await run(["a.md", "--rule", "max-sentence-length"], several);
    assert.equal(result.code, 1);
    assert.match(result.out, /Pick one with --line/u);
    assert.equal((await run(["a.md", "--rule", "max-sentence-length", "--line", "9"], several)).code, 0);
  });

  it("文書に無い行番号は断る", async () => {
    const outcomes = await ["0", "-3", "13"].reduce<Promise<{ code: number; out: string }[]>>(async (previous, line) => {
      const done = await previous;
      return [...done, await run(["a.md", "--missed", "--line", line], [])];
    }, Promise.resolve([]));
    outcomes.forEach((result) => {
      assert.equal(result.code, 1);
      assert.match(result.out, /from 1 to 12/u);
    });
  });

  it("見逃しの題は、名指しした行", async () => {
    const result = await run(["a.md", "--missed", "--line", "5"], []);
    assert.match(result.out, /Missed: a\.md line 5/u);
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

  it("名指しした rule が動いていなければ、理由を言う。試験中なら --experimental を案内する", async () => {
    const experimental = await run(
      ["a.md", "--rule", "unqualified-superlative", "--line", "5"],
      [],
      [{ rule: "unqualified-superlative", why: "まだ試験中のため", offUntilExperimental: true }],
    );
    assert.equal(experimental.code, 1);
    assert.match(
      experimental.out,
      /^unqualified-superlative did not run in this check \(まだ試験中のため\)\.\nIt is experimental: run again with --experimental\.\nNo such finding/u,
    );
    const stable = await run(["a.md", "--rule", "heading-echo"], [], [{ rule: "heading-echo", why: "設定で切っているため" }]);
    assert.match(stable.out, /^heading-echo did not run in this check \(設定で切っているため\)\.\nNo such finding/u);
    assert.doesNotMatch(stable.out, /--experimental/u);
  });

  it("動いた rule に指摘が無いだけなら、これまでどおり", async () => {
    const result = await run(["a.md", "--rule", "heading-echo"], [finding("max-sentence-length", 5)], [{ rule: "bold-density", why: "x" }]);
    assert.match(result.out, /^No such finding/u);
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
