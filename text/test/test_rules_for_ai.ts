import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import { RULE_GROUPS } from "../packages/chaff/src/rule-guide.ts";
import { runCli } from "./cli-run.ts";

// `chaff rules --json` is what an AI reads to write a team's chaff.yaml. Every rule must carry what the reference
// page carries, so the AI does not have to guess; `chaff rules` alone is the same list as a table for a person.

const RULE_IDS = loadRules("en").map((rule) => rule.id);
const GENRE_IDS = loadGenres().genres.map((genre) => genre.id);
const READER_LANGUAGES = ["ja", "en"];
const RUNS = new Set(["on", "experimental", "genre-off", "unsuited"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const jsonOf = async (lang = "en_US.UTF-8"): Promise<Record<string, unknown>> => {
  const run = await runCli({}, ["rules", "--json"], lang);
  const parsed: unknown = JSON.parse(run.out);
  if (!isRecord(parsed)) throw new Error("rules --json is not an object");
  return parsed;
};

const rulesIn = (json: Record<string, unknown>): Record<string, unknown>[] => (Array.isArray(json["rules"]) ? json["rules"].filter(isRecord) : []);

const inBoth = (value: unknown): boolean =>
  isRecord(value) && READER_LANGUAGES.every((language) => typeof value[language] === "string" && value[language] !== "");

/** What one rule's entry lacks, by field name. */
const lackingOf = (rule: Record<string, unknown>): string[] => {
  const languages = Array.isArray(rule["languages"]) ? rule["languages"].map(String) : [];
  const example = isRecord(rule["example"]) ? rule["example"] : {};
  const genres = isRecord(rule["genres"]) ? rule["genres"] : {};
  return [
    ...(RULE_GROUPS.some((group) => group === rule["group"]) ? [] : ["group"]),
    ...(inBoth(rule["summary"]) ? [] : ["summary"]),
    ...(inBoth(rule["not_flagged"]) ? [] : ["not_flagged"]),
    ...(isRecord(rule["level_meaning"]) ? [] : ["level_meaning"]),
    ...(languages.length > 0 ? [] : ["languages"]),
    ...languages.filter((language) => !isRecord(example[language])).map((language) => `example.${language}`),
    ...(Array.isArray(rule["requires"]) ? [] : ["requires"]),
    ...GENRE_IDS.filter((genre) => {
      const standing = genres[genre];
      return !isRecord(standing) || !RUNS.has(String(standing["runs"]));
    }).map((genre) => `genres.${genre}`),
  ];
};

const OLD_FIELDS = ["id", "layer", "status", "name", "why", "how_to_fix", "use_for", "level_sets", "levels", "levels_you_can_set", "your_setting", "now"];

describe("chaff rules --json — everything an AI needs to write settings", () => {
  it("is schema 2 and keeps every field of schema 1", async () => {
    const json = await jsonOf();
    assert.equal(json["schema_version"], 2);
    ["config_file", "detected", "values_you_can_use", "values_note", "how_to_change"].forEach((field) => assert.ok(field in json, field));
    const missing = rulesIn(json).flatMap((rule) => OLD_FIELDS.filter((field) => !(field in rule)).map((field) => `${String(rule["id"])}.${field}`));
    assert.deepEqual(missing, []);
  });

  it("lists every rule, each with its group, summary, example, not flagged, languages, requires and a standing in every genre", async () => {
    const rules = rulesIn(await jsonOf());
    assert.deepEqual(
      rules.map((rule) => rule["id"]),
      RULE_IDS,
    );
    const lacking = rules.flatMap((rule) => {
      const fields = lackingOf(rule);
      return fields.length === 0 ? [] : [`${String(rule["id"])}: ${fields.join(", ")}`];
    });
    assert.deepEqual(lacking, []);
  });

  it("names the groups, the steps from a style note to chaff.yaml, and the local-rules fields still to come", async () => {
    const json = await jsonOf("ja_JP.UTF-8");
    const groups = Array.isArray(json["groups"]) ? json["groups"].filter(isRecord) : [];
    assert.deepEqual(
      groups.map((group) => group["id"]),
      [...RULE_GROUPS],
    );
    assert.ok(groups.every((group) => inBoth(group["name"]) && inBoth(group["note"])));
    const steps = json["how_to_write_settings_from_a_style_note"];
    assert.ok(Array.isArray(steps) && steps.length > 0 && steps.every((step) => typeof step === "string"));
    ["style_presets", "custom_rule_types", "rule_options"].forEach((field) => {
      const coming = json[field];
      assert.ok(isRecord(coming) && coming["status"] === "coming", field);
    });
  });
});

describe("chaff rules — the same list as a table for a person", () => {
  it("prints every rule once, under its group, and is not JSON", async () => {
    const run = await runCli({}, ["rules"], "ja_JP.UTF-8");
    assert.throws(() => JSON.parse(run.out));
    const listed = run.out.split("\n").flatMap((line) => {
      const id = /^ {2}([a-z0-9-]+) /u.exec(line)?.[1];
      return id === undefined ? [] : [id];
    });
    const byName = (left: string, right: string): number => left.localeCompare(right, "en");
    assert.deepEqual(listed.toSorted(byName), RULE_IDS.toSorted(byName));
    ["読みやすさ", "事実の食い違い", "AIっぽさ", "npx chaff rules --json"].forEach((text) => assert.ok(run.out.includes(text), text));
  });

  it("shows the level in effect: chaff.yaml wins, an experimental rule is off, a rule for another language is off", async () => {
    const run = await runCli({ "chaff.yaml": "language: en\nrules:\n  max-sentence-length: strict\n" }, ["rules"], "en_US.UTF-8");
    const lineFor = (id: string): string => run.out.split("\n").find((line) => line.startsWith(`  ${id} `)) ?? "";
    assert.match(lineFor("max-sentence-length"), / strict \(18\) /u);
    assert.match(lineFor("doubled-word"), / off /u);
    assert.match(lineFor("no-doubled-joshi"), / off \(ja\) /u);
  });

  it("follows a run: a rule the genre is not suited to is off, and --experimental turns experimental rules on", async () => {
    const run = await runCli({ "chaff.yaml": "language: en\ngenre: blog/tech\n" }, ["rules", "--experimental"], "en_US.UTF-8");
    const lineFor = (id: string): string => run.out.split("\n").find((line) => line.startsWith(`  ${id} `)) ?? "";
    assert.match(lineFor("preamble-length"), / off /u);
    assert.match(lineFor("doubled-word"), / normal \(warning\) /u);
  });
});
