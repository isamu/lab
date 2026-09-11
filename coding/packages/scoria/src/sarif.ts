import type { Finding, Severity } from "./plugin.ts";
import type { Report } from "./report.ts";

/**
 * The report as SARIF 2.1.0, for GitHub code scanning (spec §22.4).
 *
 * Uploading it puts each finding on the Security tab and, more usefully, inline on the changed
 * lines of a pull request — where the person who wrote the line is already looking. A score in a
 * log is something you have to go and read; a comment on the line is not.
 */

const SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const INFORMATION_URI = "https://www.npmjs.com/package/scoria";

type Level = "error" | "warning" | "note";

interface SarifRule {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: { readonly text: string };
  readonly properties: { readonly tags: readonly string[] };
}

interface SarifResult {
  readonly ruleId: string;
  readonly level: Level;
  readonly message: { readonly text: string };
  readonly locations: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: { readonly uri: string };
      readonly region: { readonly startLine: number };
    };
  }[];
}

const levelOf = (severity: Severity): Level => (severity === "info" ? "note" : severity);

/**
 * `scoria/<probe>/<rule>` — namespaced so findings from a bundled tool cannot collide with that
 * tool's own upload, while the original rule id stays readable inside it (spec §22.4).
 */
const ruleIdOf = (finding: Finding): string => `scoria/${finding.probe}/${finding.rule}`;

const rulesIn = (findings: readonly Finding[]): readonly SarifRule[] => {
  const byId = new Map<string, Finding>();
  findings.forEach((finding) => {
    const id = ruleIdOf(finding);
    if (!byId.has(id)) byId.set(id, finding);
  });
  return [...byId.entries()].map(([id, finding]) => ({
    id,
    name: finding.rule,
    shortDescription: { text: finding.message },
    properties: { tags: [finding.dimension, `tier-${String(finding.tier)}`] },
  }));
};

const resultOf = (finding: Finding): SarifResult => ({
  ruleId: ruleIdOf(finding),
  level: levelOf(finding.severity),
  message: { text: finding.message },
  locations: [
    {
      physicalLocation: {
        artifactLocation: { uri: finding.file },
        region: { startLine: Math.max(1, finding.line) },
      },
    },
  ],
});

export const renderSarif = (report: Report, version: string): string =>
  `${JSON.stringify(
    {
      $schema: SCHEMA,
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "scoria",
              version,
              informationUri: INFORMATION_URI,
              rules: rulesIn(report.findings),
            },
          },
          results: report.findings.map(resultOf),
        },
      ],
    },
    null,
    2,
  )}\n`;
