import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { mismatchedPath } from "../packages/chaff/src/link-path.ts";

// link-text-url-mismatch: link text that shows an address on the same host as the target, at another path. Self-written.

const mismatch = (source: string, adapter = en): readonly string[] => namedRuleRun("link-text-url-mismatch", `${source}\n`, adapter).findings;

describe("link-text-url-mismatch: the same host at another path", () => {
  it("reports a shown path that the target does not start with", () => {
    assert.deepEqual(mismatch("The handbook is at [github.com/acme/handbook](https://github.com/handbook)."), [
      'The link text shows "github.com/acme/handbook" but the link goes to "github.com/handbook"',
    ]);
    assert.deepEqual(mismatch("手引きは [https://docs.example.com/v2/guide](https://docs.example.com/v1/guide) にあります。", ja), [
      "リンクの言葉は「docs.example.com/v2/guide」ですが、行き先は「docs.example.com/v1/guide」です",
    ]);
  });

  it("does not report a shortened display, a bare host, a cut display or a file name", () => {
    assert.deepEqual(mismatch("Code is at [github.com/acme](https://github.com/acme/tools/tree/main)."), []);
    assert.deepEqual(mismatch("Code is at [GitHub.com/Acme/](https://github.com/acme)."), []);
    assert.deepEqual(mismatch("See [www.example.com](https://example.com/start)."), []);
    assert.deepEqual(mismatch("See [github.com/acme/…/main](https://github.com/acme/tools/tree/main)."), []);
    assert.deepEqual(mismatch("See [README.md](https://github.com/acme/tools/blob/main/README.md)."), []);
    assert.deepEqual(mismatch("See [example.com/docs/index.html](https://example.com/docs)."), []);
    assert.deepEqual(mismatch("See [example.com/%7Eacme](https://example.com/~acme)."), []);
    assert.deepEqual(mismatch("See [https://github.com/acme/fast\\_tools](https://github.com/acme/fast_tools)."), []);
  });

  it("mismatchedPath: both directions and malformed input", () => {
    assert.deepEqual(mismatchedPath("github.com/a/b", "https://github.com/b"), { shown: "github.com/a/b", target: "github.com/b" });
    assert.equal(mismatchedPath("github.com/a", "https://github.com/a/b"), undefined);
    assert.equal(mismatchedPath("github.com/a/b", "https://gitlab.com/b"), undefined);
    assert.equal(mismatchedPath("github.com/a/b", "./b"), undefined);
    assert.equal(mismatchedPath("the guide", "https://github.com/b"), undefined);
    assert.equal(mismatchedPath("", ""), undefined);
    assert.equal(mismatchedPath("https://", "https://github.com/b"), undefined);
  });
});
