import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { modulePathOf } from "../packages/chaff/src/custom/module-path.ts";
import { parseCustomRules } from "../packages/chaff/src/custom/parse.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { detectorExport } from "../packages/chaff/src/extension/rule-export.ts";
import { staysInside } from "../packages/chaff/src/extension/real-path.ts";
import { moduleDetector, PluginRuleFailure, type UntrustedDetector } from "../packages/chaff/src/extension/module-detector.ts";
import { failureReason } from "../packages/chaff/src/extension/failure-text.ts";
import { API_VERSION, defineRule, type Detector } from "../packages/chaff/src/api.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { runCli } from "./cli-run.ts";

// type: module custom rules: a detector a team writes in JavaScript, named in chaff.yaml. Example sentences are self-written.

const noFindings: Detector = () => [];

/** A project folder, written the way this platform writes an absolute path. */
const PROJECT = resolve("/project");

const failureOf = (detect: UntrustedDetector): PluginRuleFailure => {
  const doc = buildDocument("a.md", "# Plan\n\nThe date is TBD.\n", en);
  try {
    moduleDetector(detect, "./rule.mjs")(doc, { limit: 0 });
  } catch (error) {
    if (error instanceof PluginRuleFailure) return error;
    throw error;
  }
  return assert.fail("the detector did not fail");
};

describe("type: module custom rules", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  describe("modulePathOf: a module's file may not leave the project unless named by its absolute path", () => {
    const cases: readonly (readonly [string, string | undefined])[] = [
      ["./rules/no-tbd.mjs", resolve(PROJECT, "rules/no-tbd.mjs")],
      ["rules/no-tbd.mjs", resolve(PROJECT, "rules/no-tbd.mjs")],
      ["./..hidden.mjs", resolve(PROJECT, "..hidden.mjs")],
      ["/shared/rules/no-tbd.mjs", "/shared/rules/no-tbd.mjs"],
      ["../shared/no-tbd.mjs", undefined],
      ["./rules/../../no-tbd.mjs", undefined],
      [".", undefined],
      ["..", undefined],
    ];
    cases.forEach(([written, file]) => {
      it(`${written} → ${file ?? "refused"}`, () => {
        const path = modulePathOf(written, PROJECT);
        assert.deepEqual(path, file === undefined ? { refusal: "outside" } : { file });
      });
    });
  });

  describe("staysInside: the same check on real paths, so a link cannot lead outside", () => {
    it("refuses a relative path through a link to outside; keeps an absolute one", () => {
      const root = mkdtempSync(join(tmpdir(), "chaff-link-"));
      const [project, outside] = [join(root, "project"), join(root, "outside")];
      mkdirSync(join(project, "rules"), { recursive: true });
      mkdirSync(outside);
      writeFileSync(join(project, "rules", "in.mjs"), "export default () => [];\n");
      writeFileSync(join(outside, "out.mjs"), "export default () => [];\n");
      symlinkSync(outside, join(project, "linked"), "junction");
      assert.equal(staysInside("./rules/in.mjs", join(project, "rules", "in.mjs"), project), true);
      assert.equal(staysInside("./linked/out.mjs", join(project, "linked", "out.mjs"), project), false);
      assert.equal(staysInside(join(outside, "out.mjs"), join(outside, "out.mjs"), project), true);
    });
  });

  describe("parseCustomRules: a module rule", () => {
    const CONTEXT = { builtIn: new Set<string>(), useFor: ["blog"], baseDir: PROJECT };
    const EXPLAINED = { name: "N", why: "W", how_to_fix: "H", example: { before: "B", after: "A" } };
    const parsedRule = (raw: Record<string, unknown>): RuleDefinition | undefined => parseCustomRules([{ ...EXPLAINED, ...raw }], CONTEXT).rules[0];

    it("keeps the path as written and where it resolved, and asks for tokens only when told", () => {
      const plain = parsedRule({ id: "a", type: "module", module: "./rules/a.mjs" });
      assert.deepEqual(
        [plain?.custom, plain?.how_to_find, plain?.requires, plain?.layer],
        [{ type: "module", module: "./rules/a.mjs", file: resolve(PROJECT, "rules/a.mjs") }, "module", [], "L2"],
      );
      const tagged = parsedRule({ id: "b", type: "module", module: "./b.mjs", requires: ["pos", "pos"] });
      assert.deepEqual([tagged?.requires, tagged?.layer], [["pos"], "L3"]);
    });

    it("requires means nothing to the types that know what they need", () => {
      const pattern = parsedRule({ id: "c", type: "pattern", pattern: "x", requires: ["pos"] });
      assert.deepEqual([pattern?.requires, pattern?.layer], [[], "L2"]);
    });
  });

  describe("detectorExport: what the module exports by default", () => {
    it("a function, or a rule made with defineRule", () => {
      assert.deepEqual(detectorExport(noFindings), { detect: noFindings });
      assert.deepEqual(detectorExport(defineRule({ detect: noFindings })), { detect: noFindings });
      assert.deepEqual(detectorExport({ detect: noFindings }), { detect: noFindings });
    });

    it("refuses a rule written for another API version, and anything else", () => {
      assert.deepEqual(detectorExport({ apiVersion: API_VERSION + 1, detect: noFindings }), { problem: { kind: "api-version", detail: "2" } });
      assert.deepEqual(detectorExport({ apiVersion: "1", detect: noFindings }), { problem: { kind: "api-version", detail: '"1"' } });
      assert.deepEqual(detectorExport(undefined), { problem: { kind: "bad-export", detail: "undefined" } });
      assert.deepEqual(detectorExport({ detect: "x" }), { problem: { kind: "bad-export", detail: "an object" } });
      assert.deepEqual(detectorExport([noFindings]), { problem: { kind: "bad-export", detail: "a list" } });
    });
  });

  describe("moduleDetector: a failing detector fails its own rule only", () => {
    it("a throw is a failure with its message", () => {
      const failure = failureOf(() => {
        throw new Error("no date here\nstack");
      });
      assert.deepEqual([failure.origin, failure.failure], ["./rule.mjs", { kind: "threw", message: "no date here" }]);
    });

    it("a detector cannot change the document: writing to it throws", () => {
      const failure = failureOf((doc) => Reflect.apply(Array.prototype.push, doc.sentences, ["x"]));
      assert.equal(failure.failure.kind, "threw");
    });

    it("a Promise is a wrong return, and its rejection does not end the run later", async () => {
      const failure = failureOf(() => Promise.reject(new Error("later")));
      assert.deepEqual(failure.failure, { kind: "returned", problem: { kind: "not-a-list", index: 0, written: "a Promise" } });
      await new Promise((settle) => setImmediate(settle));
    });

    it("a return that throws when read is a throw, not a crash", () => {
      const trap = new Proxy([], {
        get: () => {
          throw new Error("read me not");
        },
      });
      assert.deepEqual(failureOf(() => trap).failure, { kind: "threw", message: "read me not" });
      const getter = Object.defineProperty({}, "start", {
        get: () => {
          throw new Error("no start");
        },
      });
      assert.deepEqual(failureOf(() => [getter]).failure, { kind: "threw", message: "no start" });
    });

    it("something thrown that cannot be printed still fails only its rule", () => {
      class Unprintable extends Error {
        override get message(): string {
          throw new Error("no");
        }
      }
      assert.deepEqual(
        failureOf(() => {
          throw new Unprintable();
        }).failure,
        { kind: "threw", message: "an error that cannot be printed" },
      );
    });

    it("the reason names the file and what went wrong, in both languages", () => {
      const threw = { kind: "threw", message: "boom" } as const;
      assert.equal(failureReason("./rule.mjs", threw, "en"), "the detector in ./rule.mjs threw an error (boom)");
      assert.equal(failureReason("./rule.mjs", threw, "ja"), "./rule.mjs の検出器がエラーを投げた（boom）ため");
      const shape = { kind: "returned", problem: { kind: "bad-start", index: 2, written: "-1" } } as const;
      assert.match(failureReason("./rule.mjs", shape, "en"), /returned start -1 in finding 2/u);
      assert.match(failureReason("./rule.mjs", shape, "ja"), /2 番目の指摘の start に -1 を返した/u);
    });
  });

  describe("the command line", () => {
    const RULE = [
      "export default (doc) =>",
      "  doc.sentences.flatMap((sentence) => {",
      "    const at = sentence.text.indexOf('TBD');",
      "    return at === -1 ? [] : [{ start: sentence.span.start + at, end: sentence.span.start + at + 3 }];",
      "  });",
      "",
    ].join("\n");
    const HOPE = [
      "  - id: team-hope",
      "    type: pattern",
      "    pattern: hope",
      "    name: Hope",
      "    why: Plans",
      "    how_to_fix: Commit",
      "    example: { before: We hope., after: We will. }",
    ];
    const configWith = (module: string, extra: readonly string[] = []): string =>
      [
        "language: en",
        "custom_rules:",
        ...HOPE,
        "  - id: team-no-tbd-dates",
        "    type: module",
        `    module: ${module}`,
        "    level: error",
        "    name: A date left as TBD",
        "    why: A reader plans around a date that is not there",
        "    how_to_fix: Write the date, or who decides it and by when",
        "    example:",
        "      before: The launch is TBD.",
        "      after: The launch is on 1 October.",
        ...extra,
        "",
      ].join("\n");
    const CONFIG = configWith("./chaff-rules/no-tbd-dates.mjs");
    const DOC = "# Plan\n\nThe launch is TBD. We very much hope it goes well.\n";
    const files = (rule: string): Record<string, string> => ({ "chaff.yaml": CONFIG, "chaff-rules/no-tbd-dates.mjs": rule, "a.md": DOC });

    it("its finding reads like any rule's, at the rule's level", async () => {
      const run = await runCli(files(RULE), ["a.md", "--compact"], "en_US.UTF-8");
      assert.match(run.out, /3:15 +error +A date left as TBD: "TBD"/u);
      assert.equal(run.code, 1);
    });

    it("explain, rules --json, stet and SARIF treat it like any rule", async () => {
      const explained = await runCli(files(RULE), ["explain", "team-no-tbd-dates"], "en_US.UTF-8");
      assert.match(explained.out, /A date left as TBD/u);
      const json = await runCli(files(RULE), ["rules", "--json"], "en_US.UTF-8");
      assert.match(json.out, /"id": "team-no-tbd-dates"[\s\S]*"type": "module"/u);
      const stet = await runCli(
        { ...files(RULE), "a.md": "# Plan\n\n<!-- stet: team-no-tbd-dates — a draft -->\nThe launch is TBD.\n" },
        ["a.md", "--compact"],
        "en_US.UTF-8",
      );
      assert.equal(stet.code, 0);
      const sarif = await runCli(files(RULE), ["a.md", "--sarif", "out.sarif"], "en_US.UTF-8");
      assert.match(readFileSync(join(sarif.dir, "out.sarif"), "utf8"), /"ruleId": "chaff\/team-no-tbd-dates"/u);
    });

    it("a detector that throws is listed as not run with its file; the other rules still run", async () => {
      const run = await runCli(files("export default () => { throw new Error('no dates here'); };\n"), ["a.md"], "en_US.UTF-8");
      assert.match(run.out, /team-no-tbd-dates \(the detector in \.\/chaff-rules\/no-tbd-dates\.mjs threw an error \(no dates here\)\)/u);
      assert.match(run.out, /Hope: "hope"/u);
      assert.equal(run.code, 0);
    });

    it("a wrong return is listed as not run with what was wrong", async () => {
      const run = await runCli(files("export default () => [{ start: -1 }];\n"), ["a.md"], "en_US.UTF-8");
      assert.match(run.out, /team-no-tbd-dates \(the detector in \.\/chaff-rules\/no-tbd-dates\.mjs returned start -1 in finding 1/u);
    });

    it("tokens come with requires: [pos]", async () => {
      const rule =
        "export default (doc) => doc.sentences.flatMap((s) => (s.tokens ?? []).filter((t) => t.lemma === 'hope').map((t) => ({ start: t.span.start, end: t.span.end })));\n";
      const run = await runCli(
        { ...files(rule), "chaff.yaml": configWith("./chaff-rules/no-tbd-dates.mjs", ["    requires: [pos]"]) },
        ["a.md", "--compact"],
        "en_US.UTF-8",
      );
      assert.match(run.out, /A date left as TBD: "hope"/u);
    });

    const broken: readonly (readonly [string, Record<string, string>, RegExp])[] = [
      [
        "a missing file",
        { "chaff.yaml": CONFIG, "a.md": DOC },
        /custom_rules team-no-tbd-dates: the module file \.\/chaff-rules\/no-tbd-dates\.mjs does not exist/u,
      ],
      ["a syntax error", files("export default (doc) => {\n"), /custom_rules team-no-tbd-dates: cannot load \S*no-tbd-dates\.mjs \(/u],
      ["no default export", files("export const detect = () => [];\n"), /the default export of \S*no-tbd-dates\.mjs is not a detector \(undefined\)/u],
      [
        "another API version",
        files("export default { apiVersion: 2, detect: () => [] };\n"),
        /no-tbd-dates\.mjs was written for plugin API 2; this chaff has plugin API 1/u,
      ],
      [
        "a path outside the project",
        { "chaff.yaml": configWith("../no-tbd-dates.mjs"), "a.md": DOC },
        /module: \.\.\/no-tbd-dates\.mjs cannot be used: it is outside the folder/u,
      ],
    ];
    broken.forEach(([what, written, message]) => {
      it(`${what} stops the run and names the rule and the file`, async () => {
        const run = await runCli(written, ["a.md"], "en_US.UTF-8");
        assert.equal(run.code, 1);
        assert.match(run.err, message);
        assert.equal(run.out, "");
      });
    });
  });
});
