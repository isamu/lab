import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { runCli } from "./cli-run.ts";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import { parseGenres } from "../packages/chaff/src/genre-parse.ts";
import { keyRulesOf } from "../packages/chaff/src/genre-guide/key-rules.ts";
import { genreWasSet } from "../packages/chaff/src/genre-guide/report.ts";
import { runInit } from "../packages/chaff/src/init.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";

// What the genre's guide looks like where chaff prints it: first in the text report, in the JSON an AI reads, in
// SARIF and in fix-plan. Shown only for a genre that was set; left out by --compact, --no-guide and guide: off.

const CONTRACT = "# Services Agreement\n\n## 1. Term\n\nThis Agreement runs for one year.\n";
const CONTRACT_EN_FIRST = "Are the parties named the same way (as defined) from start to end?";
const CONTRACT_JA_FIRST = "当事者の呼び方（甲・乙、定義した名前）を、最後まで同じ形で使っているか";
const EN = "en_US.UTF-8";
const GUIDE_HEADING_EN = "Guide: Contract and terms (legal/contract)";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const step = (at: unknown, key: string | number): unknown => {
  if (Array.isArray(at) && typeof key === "number") return at[key];
  return isRecord(at) ? at[String(key)] : undefined;
};

const field = (value: unknown, ...path: (string | number)[]): unknown => path.reduce<unknown>(step, value);

const lint = async (files: Readonly<Record<string, string>>, args: readonly string[]): Promise<string> => (await runCli(files, args, EN)).out;

describe("genre guide in the text report", () => {
  it("comes first, before the file's header, with the rules that matter most", async () => {
    const out = await lint({ "contract.md": CONTRACT }, ["contract.md", "--genre", "legal/contract"]);
    const guideAt = out.indexOf(GUIDE_HEADING_EN);
    assert.ok(guideAt !== -1, out);
    assert.ok(guideAt < out.indexOf("contract.md   legal/contract"));
    assert.ok(out.includes(`  - ${CONTRACT_EN_FIRST}`));
    assert.match(out, /Rules that matter most for this genre: .*defined-term-form/u);
    assert.ok(!out.includes("Written in:"), "the bundled text alone names no source");
  });

  it("is in the document's language", async () => {
    const out = (await runCli({ "keiyaku.md": "# 業務委託契約書\n\n第1条　本契約は1年間とする。\n" }, ["keiyaku.md", "--genre", "legal/contract"])).out;
    assert.ok(out.includes("指針: 契約書・規約（legal/contract）"), out);
    assert.ok(out.includes(CONTRACT_JA_FIRST));
  });

  it("shows for a genre set in chaff.yaml, by_path or front matter", async () => {
    assert.ok((await lint({ "chaff.yaml": "genre: legal/contract\n", "a.md": CONTRACT }, ["a.md"])).includes(GUIDE_HEADING_EN));
    const byPath = 'by_path:\n  - files: ["legal/**"]\n    genre: legal/contract\n';
    assert.ok((await lint({ "chaff.yaml": byPath, "legal/a.md": CONTRACT }, ["legal/a.md"])).includes(GUIDE_HEADING_EN));
    assert.ok((await lint({ "a.md": `---\ngenre: legal/contract\n---\n${CONTRACT}` }, ["a.md"])).includes(GUIDE_HEADING_EN));
  });

  it("does not show for a defaulted genre, or one guessed from the path or the text", async () => {
    assert.ok(!(await lint({ "a.md": CONTRACT }, ["a.md"])).includes("Guide:"));
    assert.ok(!(await lint({ "docs/a.md": CONTRACT }, ["docs/a.md"])).includes("Guide:"));
    assert.ok(!(await lint({ "a.md": "# Meeting\n\nAttendees\n\nWe met.\n" }, ["a.md"])).includes("Guide:"));
    assert.deepEqual((["--genre", "by_path", "config", "front-matter", "default", "path", "content"] as const).map(genreWasSet), [
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it("is left out by --compact, --no-guide and guide: off", async () => {
    const args = ["contract.md", "--genre", "legal/contract"];
    assert.ok(!(await lint({ "contract.md": CONTRACT }, [...args, "--compact"])).includes("Guide:"));
    assert.ok(!(await lint({ "contract.md": CONTRACT }, [...args, "--no-guide"])).includes("Guide:"));
    assert.ok(!(await lint({ "chaff.yaml": "guide: off\n", "contract.md": CONTRACT }, args)).includes("Guide:"));
  });

  it("shows chaff.yaml's changes, and says where they were written", async () => {
    const config = "guide:\n  legal/contract:\n    replace:\n      en: [Payment is net 30]\n    add: Signed by both parties\n";
    const out = await lint({ "chaff.yaml": config, "contract.md": CONTRACT }, ["contract.md", "--genre", "legal/contract"]);
    assert.ok(out.includes("  - Payment is net 30\n  - Signed by both parties\n"), out);
    assert.ok(!out.includes(CONTRACT_EN_FIRST));
    assert.ok(out.includes("Written in: genres.yaml → chaff.yaml"));
  });

  it("leaves out a rule chaff.yaml turns off", async () => {
    const out = await lint({ "chaff.yaml": "rules:\n  defined-term-form: off\n", "contract.md": CONTRACT }, ["contract.md", "--genre", "legal/contract"]);
    assert.match(out, /Rules that matter most for this genre: .*numbering-gap/u);
    assert.doesNotMatch(out, /Rules that matter most for this genre: .*defined-term-form/u);
  });

  it("is printed once for several files of one genre", async () => {
    const out = await lint({ "a.md": CONTRACT, "b.md": CONTRACT }, ["a.md", "b.md", "--genre", "legal/contract"]);
    assert.equal(out.split(GUIDE_HEADING_EN).length, 2);
  });
});

describe("genre guide in JSON and SARIF", () => {
  it("rules --json has a top-level guide for a set genre, and null without one", async () => {
    const set: unknown = JSON.parse(await lint({}, ["rules", "--json", "--genre", "legal/contract"]));
    assert.equal(field(set, "guide", "genre"), "legal/contract");
    assert.equal(field(set, "guide", "lines", 0), CONTRACT_EN_FIRST);
    assert.deepEqual(field(set, "guide", "from"), ["genres.yaml"]);
    assert.ok(Array.isArray(field(set, "guide", "rules")));
    assert.equal(field(JSON.parse(await lint({}, ["rules", "--json"])), "guide"), null);
    assert.equal(field(JSON.parse(await lint({}, ["rules", "--json", "--genre", "legal/contract", "--no-guide"])), "guide"), null);
  });

  it("fix-plan --json has a top-level guide; its Markdown opens with it", async () => {
    const files = { "contract.md": CONTRACT };
    const json: unknown = JSON.parse(await lint(files, ["fix-plan", "contract.md", "--genre", "legal/contract", "--json"]));
    assert.equal(field(json, "guide", "name"), "Contract and terms");
    assert.equal(field(JSON.parse(await lint(files, ["fix-plan", "contract.md", "--json"])), "guide"), null);
    const markdown = await lint(files, ["fix-plan", "contract.md", "--genre", "legal/contract"]);
    assert.ok(markdown.indexOf(`## ${GUIDE_HEADING_EN}`) < markdown.indexOf("## Constraints"), markdown);
    assert.ok(markdown.includes(`- ${CONTRACT_EN_FIRST}`));
    assert.ok(!(await lint(files, ["fix-plan", "contract.md"])).includes("## Guide:"));
    assert.equal(field(JSON.parse(await lint(files, ["fix-plan", "contract.md", "--genre", "legal/contract", "--no-guide", "--json"])), "guide"), null);
    const off = await lint({ ...files, "chaff.yaml": "guide: off\n" }, ["fix-plan", "contract.md", "--genre", "legal/contract"]);
    assert.ok(!off.includes("## Guide:"));
  });

  it("SARIF carries the run's guides in the run's properties", async () => {
    const run = await runCli({ "contract.md": CONTRACT }, ["contract.md", "--genre", "legal/contract", "--compact", "--sarif", "out.sarif"], EN);
    const sarif: unknown = JSON.parse(readFileSync(join(run.dir, "out.sarif"), "utf8"));
    assert.equal(field(sarif, "runs", 0, "properties", "guides", 0, "genre"), "legal/contract");
    assert.equal(field(sarif, "runs", 0, "properties", "guides", 0, "language"), "en");
    const none = await runCli({ "contract.md": CONTRACT }, ["contract.md", "--sarif", "out.sarif"], EN);
    assert.equal(field(JSON.parse(readFileSync(join(none.dir, "out.sarif"), "utf8")), "runs", 0, "properties"), undefined);
  });
});

describe("keyRulesOf", () => {
  const rule = (
    id: string,
    useFor: string[],
    status: RuleDefinition["status"] = "stable",
  ): Pick<RuleDefinition, "id" | "status" | "use_for" | "languages"> => ({
    id,
    status,
    use_for: useFor,
    languages: undefined,
  });
  const data = parseGenres({
    groups: [
      { id: "legal", name: { ja: "法務", en: "Legal" }, rules: { "numbering-gap": "normal" } },
      { id: "blog", name: { ja: "ブログ", en: "Blog" } },
      { id: "docs", name: { ja: "説明書", en: "Docs" } },
    ],
    genres: ["legal/contract", "legal/statute", "blog/tech", "blog/essay", "docs/manual"].map((id) => ({
      id,
      name: { ja: id, en: id },
      summary: { ja: id, en: id },
    })),
  });

  it("names the preset's rules and the rules that run in few genres, sorted", () => {
    const rules = [rule("numbering-gap", ["legal"]), rule("long-sentence", ["legal", "blog", "docs"]), rule("closing-cliche", ["blog/tech"])];
    assert.deepEqual(keyRulesOf(rules, data, "legal/contract", "en", {}), ["numbering-gap"]);
    assert.deepEqual(keyRulesOf(rules, data, "blog/tech", "en", {}), ["closing-cliche"]);
    assert.deepEqual(keyRulesOf(rules, data, "docs/manual", "en", {}), []);
  });

  it("leaves out a rule the settings turn off, an experimental one not on, and one for another language", () => {
    const rules = [rule("numbering-gap", ["legal"]), rule("trial", ["blog/tech"], "experimental"), { ...rule("ja-only", ["blog/tech"]), languages: ["ja"] }];
    assert.deepEqual(keyRulesOf(rules, data, "legal/contract", "en", { "numbering-gap": "off" }), []);
    assert.deepEqual(keyRulesOf(rules, data, "blog/tech", "en", {}), []);
    assert.deepEqual(keyRulesOf(rules, data, "blog/tech", "ja", {}), ["ja-only"]);
  });

  it("is empty for a genre chaff does not know", () => {
    assert.deepEqual(keyRulesOf([rule("numbering-gap", ["legal"])], loadGenres(), "nope/none", "en", {}), []);
  });
});

describe("chaff init's guide example", () => {
  it("is a comment naming the chosen genre, so chaff.yaml still sets no guide", () => {
    (["ja", "en"] as const).forEach((ui) => {
      const root = mkdtempSync(join(tmpdir(), "chaff-init-guide-"));
      runInit(root, "legal/contract", ui);
      const written = readFileSync(join(root, "chaff.yaml"), "utf8");
      assert.match(written, /^# guide:\n# {3}legal\/contract:\n# {5}add:\n/mu);
      assert.equal(field(parse(written), "guide"), undefined);
    });
  });
});
