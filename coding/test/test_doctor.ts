import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFixes, diagnose } from "../packages/scoria/src/doctor.ts";
import { configGaps } from "../packages/scoria/src/probes/config-integrity.ts";
import { ciGaps } from "../packages/scoria/src/probes/ci-integrity.ts";

const project = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-doctor-"));
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      await mkdir(join(root, path, "..").replace(/\/\.\.$/, "/.."), { recursive: true }).catch(() => undefined);
      const directory = path.includes("/") ? join(root, path.slice(0, path.lastIndexOf("/"))) : root;
      await mkdir(directory, { recursive: true });
      await writeFile(join(root, path), text, "utf8");
    }),
  );
  return root;
};

const ids = (gaps: readonly { id: string }[]): readonly string[] => gaps.map((gap) => gap.id);

test("reports a missing ESLint config as an error", () => {
  const gaps = configGaps([{ path: "package.json", text: "{}" }], false);
  assert.ok(ids(gaps).includes("eslint-missing"));
  assert.equal(gaps.find((gap) => gap.id === "eslint-missing")?.severity, "error");
});

test("reports flat and legacy configs living together", () => {
  const files = [
    { path: "eslint.config.js", text: "export default [];" },
    { path: ".eslintrc.json", text: "{}" },
  ];
  assert.ok(ids(configGaps(files, false)).includes("eslint-duplicate"));
});

test("reports strict mode being off", () => {
  const files = [{ path: "tsconfig.json", text: '{"compilerOptions":{"strict":false}}' }];
  assert.ok(ids(configGaps(files, true)).includes("tsconfig-strict"));
});

test("says nothing about strict mode when it is on", () => {
  const files = [{ path: "tsconfig.json", text: '{"compilerOptions":{"strict":true}}' }];
  assert.ok(!ids(configGaps(files, true)).includes("tsconfig-strict"));
});

test("asks for a typecheck script only in a TypeScript project", () => {
  const files = [{ path: "package.json", text: '{"scripts":{"lint":"x","build":"x","test":"x"}}' }];
  assert.ok(ids(configGaps(files, true)).includes("script-typecheck"));
  assert.ok(!ids(configGaps(files, false)).includes("script-typecheck"));
});

test("reports the absence of any CI workflow as an error", () => {
  const gaps = ciGaps([{ path: "package.json", text: "{}" }], false);
  assert.deepEqual(ids(gaps), ["ci-missing"]);
  assert.equal(gaps[0]?.severity, "error");
});

/** A job that swallows its failure is green whatever it found. */
test("reports steps that swallow their failure", () => {
  const files = [{ path: ".github/workflows/ci.yml", text: "steps:\n  - run: yarn lint && yarn build && yarn test || true\n" }];
  assert.ok(ids(ciGaps(files, false)).includes("ci-swallowed-failures"));
});

test("does not report steps CI actually runs", () => {
  const files = [{ path: ".github/workflows/ci.yml", text: "steps:\n  - run: yarn lint\n  - run: yarn build\n  - run: yarn test\n" }];
  assert.deepEqual(ids(ciGaps(files, false)), []);
});

test("--fix appends node_modules to .gitignore", async () => {
  const root = await project({ "package.json": '{"scripts":{"lint":"x","build":"x","test":"x"}}', ".gitignore": "dist/\n" });
  const applied = await applyFixes(await diagnose(root));
  assert.equal(applied.length, 1);
  assert.match(await readFile(join(root, ".gitignore"), "utf8"), /^node_modules\/$/m);
});

test("--fix adds a typecheck script without disturbing the others", async () => {
  const root = await project({
    "package.json": '{\n  "devDependencies": { "typescript": "^6" },\n  "scripts": {\n    "lint": "eslint ."\n  }\n}\n',
    ".gitignore": "node_modules/\n",
  });
  await applyFixes(await diagnose(root));
  const text = await readFile(join(root, "package.json"), "utf8");
  assert.match(text, /"typecheck": "tsc --noEmit"/);
  assert.match(text, /"lint": "eslint \."/);
});

/** Choosing a lint configuration for someone is a judgement; appending to .gitignore is not. */
test("leaves everything that needs a judgement alone", async () => {
  const root = await project({ "package.json": "{}", ".gitignore": "node_modules/\n" });
  const diagnosis = await diagnose(root);
  const applied = await applyFixes(diagnosis);
  assert.ok(ids(diagnosis.gaps).includes("eslint-missing"));
  assert.deepEqual(applied, []);
});
