import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyDocuments, driftedIds, errorText, firstDifferingLine, issueBody, needsAttention, type FetchOutcome } from "../scripts/corpus-health-report.ts";
import { HttpStatusError } from "../scripts/fetch-text.ts";
import { isTransientFetchError, withRetry, type RetryOptions } from "../scripts/retry.ts";

// 週に一度のコーパス点検。文書ごとの判定（ok / drift / fetch-failed / source-changed）、issue の本文、取得の再試行。

const REPORT = [
  "rouki.txt  clean",
  "a  max-sentence-length 2",
  "",
  "Changed from corpus/expected.txt (yarn corpus --update to accept):",
  "- a  max-sentence-length 1",
  "+ a  max-sentence-length 2",
  "+ new-doc  clean",
  "- gone  clean",
  "",
].join("\n");

describe("driftedIds", () => {
  it("Changed from の後の - / + 行から id を取る", () => {
    assert.deepEqual([...driftedIds(REPORT)], ["a", "new-doc", "gone"]);
  });

  it("見出しより前の行は数えない", () => {
    assert.deepEqual([...driftedIds("- a  clean\n+ b  clean\n")], []);
  });

  it("変化が無い、空、見出しだけ、のときは何も返さない", () => {
    assert.deepEqual([...driftedIds("a  clean\n")], []);
    assert.deepEqual([...driftedIds("")], []);
    assert.deepEqual([...driftedIds("Changed from corpus/expected.txt (yarn corpus --update to accept):\n")], []);
  });

  it("id の無い - / + 行は落とす", () => {
    assert.deepEqual([...driftedIds("Changed from corpus/expected.txt\n- \n+   clean\n")], []);
  });
});

describe("firstDifferingLine", () => {
  it("同じなら undefined", () => {
    assert.equal(firstDifferingLine("a\nb\n", "a\nb\n"), undefined);
    assert.equal(firstDifferingLine("", ""), undefined);
  });

  it("最初に違う行を 1 から数えて返す", () => {
    assert.equal(firstDifferingLine("a\nb\nc\n", "a\nx\nc\n"), 2);
    assert.equal(firstDifferingLine("a\n", "b\n"), 1);
  });

  it("片方がもう片方の先頭部分でも、伸びた・縮んだ行を返す", () => {
    assert.equal(firstDifferingLine("a\n", "a\nb\n"), 2);
    assert.equal(firstDifferingLine("a\nb\n", "a\n"), 2);
    assert.equal(firstDifferingLine("a", "a\n"), 2);
  });

  it("コミット済みの写しが無い（空）ときは 1 行目", () => {
    assert.equal(firstDifferingLine("", "text\n"), 1);
  });
});

describe("classifyDocuments", () => {
  const outcomes: FetchOutcome[] = [
    { id: "ok-doc", kind: "fetched" },
    { id: "a", kind: "fetched" },
    { id: "dead", kind: "failed", error: "https://example.com/x: HTTP 404" },
    { id: "moved", kind: "differs", line: 12 },
  ];

  it("取得できて expected と同じなら ok、変わっていれば drift、失敗は fetch-failed、写しと違えば source-changed", () => {
    assert.deepEqual(classifyDocuments(outcomes, new Set(["a"])), [
      { id: "ok-doc", status: "ok" },
      { id: "a", status: "drift" },
      { id: "dead", status: "fetch-failed", error: "https://example.com/x: HTTP 404" },
      { id: "moved", status: "source-changed", line: 12 },
    ]);
  });

  it("取得の失敗は drift より先に出す（取れなかった文書は比べていない）", () => {
    assert.deepEqual(classifyDocuments([{ id: "dead", kind: "failed", error: "e" }], new Set(["dead"])), [{ id: "dead", status: "fetch-failed", error: "e" }]);
  });

  it("写しが上流と違うことは drift より先に出す", () => {
    assert.deepEqual(classifyDocuments([{ id: "moved", kind: "differs", line: 1 }], new Set(["moved"])), [{ id: "moved", status: "source-changed", line: 1 }]);
  });

  it("取り直していない id（法令、manifest から消えた文書）の drift も落とさない", () => {
    assert.deepEqual(classifyDocuments([], new Set(["rouki.txt", "gone"])), [
      { id: "rouki.txt", status: "drift" },
      { id: "gone", status: "drift" },
    ]);
  });

  it("何も無ければ空", () => {
    assert.deepEqual(classifyDocuments([], new Set()), []);
  });
});

describe("needsAttention", () => {
  it("ok だけなら false、一つでも他があれば true", () => {
    assert.equal(needsAttention([]), false);
    assert.equal(needsAttention([{ id: "a", status: "ok" }]), false);
    assert.equal(
      needsAttention([
        { id: "a", status: "ok" },
        { id: "b", status: "fetch-failed", error: "e" },
      ]),
      true,
    );
    assert.equal(needsAttention([{ id: "b", status: "source-changed", line: 1 }]), true);
    assert.equal(needsAttention([{ id: "b", status: "drift" }]), true);
  });
});

describe("issueBody", () => {
  it("取得の失敗、上流の変化、結果の変化を、それぞれ文書ごとに書く", () => {
    const outcomes: FetchOutcome[] = [
      { id: "dead", kind: "failed", error: "HTTP 404" },
      { id: "moved", kind: "differs", line: 3 },
    ];
    const body = issueBody(classifyDocuments(outcomes, driftedIds(REPORT)), REPORT, "https://run");
    assert.match(body, /Run: https:\/\/run/u);
    assert.match(body, /## Fetch failed\n\n- `dead`: HTTP 404\n/u);
    assert.match(body, /## Source changed upstream\n\n- `moved`: differs from line 3\n/u);
    assert.match(body, /## Results drifted\n\n```\nChanged from corpus\/expected.txt[^\n]*\n- a {2}max-sentence-length 1\n\+ a {2}max-sentence-length 2\n/u);
    assert.ok(body.endsWith("\n") && !body.endsWith("\n\n"));
  });

  it("無いものの節は出さない", () => {
    const body = issueBody([{ id: "dead", status: "fetch-failed", error: "timeout" }], "a  clean\n", "r");
    assert.match(body, /## Fetch failed/u);
    assert.doesNotMatch(body, /Source changed upstream|Results drifted/u);
  });
});

describe("errorText", () => {
  it("原因の文言のうち、まだ出ていないものを括弧で足す", () => {
    const network = new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND x.invalid") });
    const outer = new Error("https://x.invalid/a: fetch failed", { cause: network });
    assert.equal(errorText(outer), "https://x.invalid/a: fetch failed (getaddrinfo ENOTFOUND x.invalid)");
  });

  it("原因の文言が既に含まれていれば繰り返さない", () => {
    assert.equal(errorText(new Error("https://e.com/a: HTTP 404", { cause: new HttpStatusError(404) })), "https://e.com/a: HTTP 404");
  });

  it("Error でない値、原因の無い Error、循環する原因も読める", () => {
    assert.equal(errorText("plain"), "plain");
    assert.equal(errorText(new Error("only")), "only");
    const loop = new Error("a");
    loop.cause = loop;
    assert.equal(errorText(loop), "a");
    assert.equal(errorText(new Error("a", { cause: "b" })), "a (b)");
  });
});

describe("isTransientFetchError", () => {
  const wrapped = (status: number): Error => new Error(`https://example.com: HTTP ${String(status)}`, { cause: new HttpStatusError(status) });

  it("404 など 4xx は再試行しない", () => {
    [400, 401, 403, 404, 410, 451].forEach((status) => assert.equal(isTransientFetchError(wrapped(status)), false, String(status)));
  });

  it("5xx、408、425、429 は再試行する", () => {
    [408, 425, 429, 500, 502, 503, 504].forEach((status) => assert.equal(isTransientFetchError(wrapped(status)), true, String(status)));
  });

  it("状態の無い失敗（timeout、接続の切断）は再試行する", () => {
    assert.equal(isTransientFetchError(new Error("x: This operation was aborted", { cause: new DOMException("aborted", "AbortError") })), true);
    assert.equal(isTransientFetchError(new TypeError("fetch failed")), true);
    assert.equal(isTransientFetchError("not an error"), true);
    assert.equal(isTransientFetchError(undefined), true);
  });

  it("包まれていない HttpStatusError もそのまま読む", () => {
    assert.equal(isTransientFetchError(new HttpStatusError(404)), false);
    assert.equal(isTransientFetchError(new HttpStatusError(503)), true);
  });
});

describe("withRetry", () => {
  const options = (waits: number[]): RetryOptions => ({
    delays_ms: [5, 20],
    isTransient: isTransientFetchError,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });

  const failingTimes = (failures: readonly Error[]): { attempt: () => Promise<string>; calls: () => number } => {
    const state = { calls: 0 };
    return {
      attempt: () => {
        const failure = failures[state.calls];
        state.calls += 1;
        return failure === undefined ? Promise.resolve("text") : Promise.reject(failure);
      },
      calls: () => state.calls,
    };
  };

  it("一度で取れれば待たない", async () => {
    const waits: number[] = [];
    const run = failingTimes([]);
    assert.equal(await withRetry(run.attempt, options(waits)), "text");
    assert.deepEqual(waits, []);
    assert.equal(run.calls(), 1);
  });

  it("一時的な失敗は間を広げて取り直す", async () => {
    const waits: number[] = [];
    const run = failingTimes([new HttpStatusError(503), new TypeError("fetch failed")]);
    assert.equal(await withRetry(run.attempt, options(waits)), "text");
    assert.deepEqual(waits, [5, 20]);
    assert.equal(run.calls(), 3);
  });

  it("待ちを使い切ったら最後の失敗を投げる", async () => {
    const waits: number[] = [];
    const last = new HttpStatusError(502);
    const run = failingTimes([new HttpStatusError(503), new HttpStatusError(504), last]);
    await assert.rejects(withRetry(run.attempt, options(waits)), (err) => err === last);
    assert.deepEqual(waits, [5, 20]);
    assert.equal(run.calls(), 3);
  });

  it("404 は取り直さずに投げる", async () => {
    const waits: number[] = [];
    const run = failingTimes([new HttpStatusError(404)]);
    await assert.rejects(withRetry(run.attempt, options(waits)), /HTTP 404/u);
    assert.deepEqual(waits, []);
    assert.equal(run.calls(), 1);
  });

  it("待ちが空なら一度だけ試す", async () => {
    const waits: number[] = [];
    const run = failingTimes([new TypeError("fetch failed")]);
    await assert.rejects(withRetry(run.attempt, { ...options(waits), delays_ms: [] }), /fetch failed/u);
    assert.equal(run.calls(), 1);
  });

  it("取り直すたびに onRetry に理由と待ちを渡す", async () => {
    const seen: string[] = [];
    const run = failingTimes([new HttpStatusError(429)]);
    await withRetry(run.attempt, { ...options([]), onRetry: (err, ms) => seen.push(`${err instanceof Error ? err.message : ""} ${String(ms)}`) });
    assert.deepEqual(seen, ["HTTP 429 5"]);
  });
});
