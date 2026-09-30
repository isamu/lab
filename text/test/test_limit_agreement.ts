import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter, ProseDocument, RuleDefinition } from "../packages/chaff/src/plugin.ts";

// A rule's message states its limit. "N まで" / "limit N" / "N% allowed" let N pass; "N% 以上ほしい" / "want N%" let N pass
// from below; "N 種から" / "N needed" report from N. The finding's own value must sit on the side the message says.
type Direction = "upper" | "lower" | "from";

const withoutPlaceholders = (message: string): string =>
  message
    .split("{")
    .map((piece, index) => (index === 0 ? piece : piece.slice(piece.indexOf("}") + 1)))
    .join("");

const directionOf = (message: string): Direction | undefined => {
  if (!message.includes("{limit}")) return undefined;
  const words = withoutPlaceholders(message);
  if (/以上ほしい|want/u.test(words)) return "lower";
  if (/から）|needed/u.test(words)) return "from";
  if (/まで|limit|allowed/u.test(words)) return "upper";
  return undefined;
};

const reported = (direction: Direction, value: number, limit: number): boolean => {
  if (direction === "upper") return value > limit;
  if (direction === "lower") return value < limit;
  return value >= limit;
};

// The value a detector compares with its limit. Density rules show it as density, the spread rules as variance.
const MEASURED_KEYS = ["density", "variance", "share", "count"];

const measuredOf = (finding: Finding): number => Number(finding.values[MEASURED_KEYS.find((key) => key in finding.values) ?? "count"]);

const LOOSE_LIMIT = { upper: 1, lower: 1000, from: 1 };

const findingsAt = (doc: ProseDocument, rules: readonly RuleDefinition[], rule: RuleDefinition, limit: number): Finding[] =>
  runRules(doc, rules, {}, true, rule.use_for[0] ?? "business", { [rule.id]: limit }).findings.filter((finding) => finding.rule === rule.id);

/** The limit that lets this value pass, and the one just past it that must report it. */
const passing = (direction: Direction, value: number): number => (direction === "from" ? value + 1 : value);
const PAST_BY: Readonly<Record<Direction, number>> = { upper: -1, lower: 1, from: 0 };
const failing = (direction: Direction, value: number): number => value + PAST_BY[direction];

const hasValue = (findings: readonly Finding[], value: number): boolean => findings.some((finding) => measuredOf(finding) === value);

const checkValue = (doc: ProseDocument, all: readonly RuleDefinition[], rule: RuleDefinition, direction: Direction, value: number): void => {
  assert.ok(!hasValue(findingsAt(doc, all, rule, passing(direction, value)), value), `${rule.id}: ${String(value)} reported at the limit that allows it`);
  assert.ok(hasValue(findingsAt(doc, all, rule, failing(direction, value)), value), `${rule.id}: ${String(value)} not reported just past the limit`);
};

const checkRule = (doc: ProseDocument, all: readonly RuleDefinition[], rule: RuleDefinition, direction: Direction): void => {
  const loose = findingsAt(doc, all, rule, LOOSE_LIMIT[direction]);
  assert.ok(loose.length > 0, `the fixture never exercises ${rule.id}`);
  loose.forEach((finding) => assert.ok(reported(direction, measuredOf(finding), Number(finding.values["limit"])), `${rule.id}: value against its own limit`));
  new Set(loose.map(measuredOf)).forEach((value) => checkValue(doc, all, rule, direction, value));
};

const ADAPTERS: ReadonlyArray<readonly [string, LanguageAdapter]> = [
  ["ja", ja],
  ["en", en],
];

ADAPTERS.forEach(([language, adapter]) => {
  describe(`limit agreement (${language}): a limit the message allows is not reported, one past it is`, () => {
    const all = loadRules(language).filter((rule) => rule.languages === undefined || rule.languages.includes(language));
    let doc: ProseDocument;

    before(async () => {
      await adapter.prepare?.({ pos: true });
      doc = buildDocument(`${language}.md`, readFileSync(new URL(`fixtures/limits/${language}.md`, import.meta.url), "utf8"), adapter);
    });

    all.forEach((rule) => {
      const direction = directionOf(rule.message[language] ?? "");
      if (direction === undefined) return;
      it(`${rule.id} (${direction})`, () => {
        checkRule(doc, all, rule, direction);
      });
    });
  });
});
