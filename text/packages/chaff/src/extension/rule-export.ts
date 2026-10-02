import { API_VERSION } from "../api.ts";
import { describeValue } from "./returned-findings.ts";
import type { UntrustedDetector } from "./module-detector.ts";

// What a type: module file exports, read as a detector. The default export is the detector itself, or a rule made with
// defineRule ({ apiVersion, detect }). A function carries no version and is read against this chaff's API; a rule that
// names another version is refused, since its detector expects another document. Pure.

/** bad-export: detail says what was exported instead. api-version: detail is the version the rule names. */
export type ExportProblem = { readonly kind: "bad-export" | "api-version"; readonly detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isDetector = (value: unknown): value is UntrustedDetector => typeof value === "function";

/** The detector a module's default export gives, or what is wrong with it. */
export const detectorExport = (exported: unknown): { readonly detect: UntrustedDetector } | { readonly problem: ExportProblem } => {
  if (isDetector(exported)) return { detect: exported };
  if (!isRecord(exported) || !isDetector(exported["detect"])) return { problem: { kind: "bad-export", detail: describeValue(exported) } };
  const version = exported["apiVersion"];
  if (version !== undefined && version !== API_VERSION) return { problem: { kind: "api-version", detail: JSON.stringify(version) ?? describeValue(version) } };
  return { detect: exported["detect"] };
};
