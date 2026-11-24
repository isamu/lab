// scope: on a team rule: the parts of the document a words, pattern or tokens rule reads. Pure.
import type { CustomSpec, ScopeSelector } from "../plugin.ts";
import { scopeSelectorOf } from "../text-scope.ts";
import { failed, ok, type Checked } from "./checked.ts";

/** scope: the parts of the document the rule reads. A module reads the document itself, so a scope would silently do nothing. */
export const scopeOf = (raw: unknown, type: string, at: string): Checked<ScopeSelector | undefined> => {
  if (raw === undefined) return ok(undefined);
  if (type === "module") return failed({ kind: "module-scope", at });
  const read = scopeSelectorOf(raw);
  return "selector" in read ? ok(read.selector) : failed({ kind: "bad-scope", at, written: read.problem.written, problem: read.problem.kind });
};

/** The spec with the rule's scope. A module never has one: scopeOf refuses it. */
export const scopedSpec = (spec: CustomSpec, scope: ScopeSelector | undefined): CustomSpec =>
  scope === undefined || spec.type === "module" ? spec : { ...spec, scope };
