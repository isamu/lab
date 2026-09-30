import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./cli-run.ts";

// --genre and chaff.yaml's genre as the commands besides a check read them: what they report must be what a run does.

const RULE = "（目的）\n第一条　この規則は、手続を定める。\n　前項の手続は、理事会が行う。\n（適用）\n第二条　前条第二項の規定は、会員に適用する。\n";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const nowOf = (json: string, id: string): Record<string, unknown> | undefined => {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || !("rules" in parsed) || !Array.isArray(parsed.rules)) throw new Error("no rules");
  const entry: unknown = parsed.rules.find(
    (candidate: unknown) => typeof candidate === "object" && candidate !== null && "id" in candidate && candidate.id === id,
  );
  const now = isRecord(entry) ? entry["now"] : undefined;
  return isRecord(now) ? now : undefined;
};

describe("rules --json と explain はジャンルの段を見る", () => {
  it("rules --json は --genre のジャンルの段を、いまの段として出す", async () => {
    const run = await runCli({}, ["rules", "--json", "--genre", "legal/contract"], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.deepEqual(nowOf(run.out, "ngram-repetition"), { level: "off", why_off: "the legal/contract genre does not check it" });
  });

  it("rules --json は --genre が無ければ chaff.yaml の genre を見る", async () => {
    const run = await runCli({ "chaff.yaml": "genre: legal/contract\n" }, ["rules", "--json"], "en_US.UTF-8");
    assert.deepEqual(nowOf(run.out, "ngram-repetition"), { level: "off", why_off: "the legal/contract genre does not check it" });
  });

  it("--genre は chaff.yaml の genre に勝つ", async () => {
    const run = await runCli({ "chaff.yaml": "genre: legal/contract\n" }, ["rules", "--json", "--genre", "blog/tech"], "en_US.UTF-8");
    assert.equal(nowOf(run.out, "ngram-repetition")?.["level"], "normal");
  });

  it("explain は --genre のジャンルで止めた rule を off と言う", async () => {
    const run = await runCli({}, ["explain", "ngram-repetition", "--genre", "literature/fiction"], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.match(run.out, /Now: off\./u);
    const plain = await runCli({}, ["explain", "ngram-repetition"], "en_US.UTF-8");
    assert.match(plain.out, /Now: normal\./u);
  });
});

describe("tree はジャンルの profile で読む", () => {
  it("chaff.yaml の genre が法令なら、形が少なくても法令として読む", async () => {
    const withGenre = await runCli({ "chaff.yaml": "genre: legal/statute\n", "rule.txt": RULE }, ["tree", "rule.txt"]);
    assert.equal(withGenre.code, 0);
    assert.match(withGenre.out, /:profile "statute"/u);
    assert.match(withGenre.out, /\(reference :label "前条第二項" :target "1\.2"/u);
    const without = await runCli({ "rule.txt": RULE }, ["tree", "rule.txt"]);
    assert.doesNotMatch(without.out, /:profile/u);
  });

  it("--genre の値は読むファイルではない", async () => {
    const run = await runCli({ "rule.txt": RULE }, ["tree", "--genre", "legal/statute", "rule.txt"]);
    assert.equal(run.code, 0);
    assert.equal(run.err, "");
    assert.match(run.out, /:profile "statute"/u);
  });
});
