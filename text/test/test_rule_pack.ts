import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { runCli } from "./cli-run.ts";

// A rule pack: a plugin written in YAML alone (rules/*.yaml, lexicons/<language>/*.yaml, styles/*.yaml and a manifest).
// examples/chaff-plugin-clear-requests is one; it is loaded here as a user would, so it cannot rot.

const PACK = join(import.meta.dirname, "..", "examples", "chaff-plugin-clear-requests");

const JA = "# 資料のお願い\n\n来週の会議の資料を、近日中に送ってください。その日は出席できないけど、議事録は読みます。\n";
const EN = "# Slides for the review\n\nPlease send the slides for next week's review soon. I can't attend that day, but I will read the notes.\n";

/** Every file of the example pack, under folder, so a test can change one and load the copy. */
const packFiles = (folder: string): Record<string, string> => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
  return Object.fromEntries(walk(PACK).map((file) => [`${folder}/${relative(PACK, file).split(sep).join("/")}`, readFileSync(file, "utf8")]));
};

const config = (...plugins: readonly string[]): string => ["genre: business/email", "plugins:", ...plugins.map((plugin) => `  - ${plugin}`), ""].join("\n");

/** The rule ids lint reported, in order. */
const reported = (out: string): string[] => [...out.matchAll(/^ {18}(\S+)$/gmu)].map((match) => match[1] ?? "");

describe("rule pack — the example, as a user loads it", () => {
  it("flags a vague deadline and a casual form in Japanese and in English, under the pack's name", async () => {
    const run = await runCli({ "chaff.yaml": config(PACK), "ja.md": JA, "en.md": EN }, ["ja.md", "en.md", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    const ids = reported(run.out).filter((id) => id.startsWith("clear-requests/"));
    assert.deepEqual(ids, [
      "clear-requests/vague-deadline",
      "clear-requests/formal-register",
      "clear-requests/vague-deadline",
      "clear-requests/formal-register",
    ]);
    assert.match(run.out, /"soon" is not a date/u);
    assert.match(run.out, /「ないけど」は「ませんが」と書きます/u);
  });

  it("ships a preset: its style turns both rules up a level", async () => {
    const yaml = `style: clear-requests/strict-requests\n${config(PACK)}`;
    const run = await runCli({ "chaff.yaml": yaml, "en.md": EN }, ["en.md", "--compact"], "en_US.UTF-8");
    assert.match(run.out, /error {3}"soon" is not a date/u);
    assert.match(run.out, /warning Write "cannot", not "can't"/u);
  });

  it("lists the register rule apart in a light fix plan, and plans it at depth register", async () => {
    const files = { "chaff.yaml": config(PACK), "en.md": EN };
    const light = await runCli(files, ["fix-plan", "en.md", "--depth", "light"], "en_US.UTF-8");
    assert.match(light.out, /- `clear-requests\/formal-register` A casual form: depth register, 1 spot/u);
    const register = await runCli(files, ["fix-plan", "en.md", "--depth", "register"], "en_US.UTF-8");
    assert.match(register.out, /### `clear-requests\/formal-register` A casual form\n\n\*\*Depth\*\*: register/u);
  });

  it("explains a pack rule, lists it in rules --json, and relaxes and stets it like any rule", async () => {
    const explain = await runCli({ "chaff.yaml": config(PACK) }, ["explain", "clear-requests/vague-deadline"], "en_US.UTF-8");
    assert.match(explain.out, /This rule comes from the plugin clear-requests\./u);
    const json = await runCli({ "chaff.yaml": config(PACK) }, ["rules", "--json"], "en_US.UTF-8");
    assert.match(json.out, /"id": "clear-requests\/vague-deadline"/u);
    assert.match(json.out, /"defined_in": "plugin clear-requests"/u);
    const relaxed = await runCli({ "chaff.yaml": config(PACK) }, ["relax", "clear-requests/vague-deadline", "--why", "drafts"], "en_US.UTF-8");
    assert.equal(relaxed.code, 0, relaxed.err);
    const stetted = EN.replace("soon.", "soon. <!-- stet: clear-requests/vague-deadline — a draft -->");
    const run = await runCli({ "chaff.yaml": config(PACK), "en.md": stetted }, ["en.md", "--compact"], "en_US.UTF-8");
    assert.ok(!reported(run.out).includes("clear-requests/vague-deadline"));
  });
});

describe("rule pack — what goes wrong, and what the user is told", () => {
  it("does not run a rule whose word list the pack lacks in the document's language, and says why", async () => {
    const files = packFiles("pack");
    delete files["pack/lexicons/en/vague-deadline.yaml"];
    const run = await runCli({ ...files, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /clear-requests\/vague-deadline \(the plugin clear-requests has no en word list vague-deadline\)/u);
    const ja = await runCli({ ...files, "chaff.yaml": config("./pack"), "ja.md": JA }, ["ja.md", "--compact"], "en_US.UTF-8");
    assert.ok(reported(ja.out).includes("clear-requests/vague-deadline"), "the Japanese list is still there");
  });

  it("stops on a rule whose depth is not a depth, naming the pack and the rule", async () => {
    const files = packFiles("pack");
    files["pack/rules/vague-deadline.yaml"] = (files["pack/rules/vague-deadline.yaml"] ?? "").replace("depth: light", "depth: deep");
    const run = await runCli({ ...files, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /plugins \.\/pack rules vague-deadline: rewrite\.depth: deep is not a rewrite depth/u);
  });

  it("refuses two packs with one name, and one pack with two rules of one id", async () => {
    const two = { ...packFiles("one"), ...packFiles("two"), "chaff.yaml": config("./one", "./two"), "en.md": EN };
    const twice = await runCli(two, ["en.md"], "en_US.UTF-8");
    assert.equal(twice.code, 1);
    assert.match(twice.err, /plugins \.\/two: another plugin is named clear-requests/u);
    const files = packFiles("pack");
    files["pack/rules/again.yaml"] = files["pack/rules/vague-deadline.yaml"] ?? "";
    const dup = await runCli({ ...files, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(dup.code, 1);
    assert.match(dup.err, /vague-deadline: another rule has the same id/u);
  });

  it("names the file of a pack that is not YAML", async () => {
    const files = packFiles("pack");
    files["pack/rules/broken.yaml"] = "id: [unclosed\n";
    const run = await runCli({ ...files, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /plugins \.\/pack: cannot load it \(rules\/broken\.yaml: /u);
  });

  it("finds a pack installed as a package, with chaff-plugin.yaml as its manifest and no code at all", async () => {
    const files = Object.fromEntries(
      Object.entries(packFiles("node_modules/chaff-plugin-clear-requests")).map(([path, text]) =>
        path.endsWith("package.json") ? [path, JSON.stringify({ name: "chaff-plugin-clear-requests", version: "1.0.0" })] : [path, text],
      ),
    );
    files["node_modules/chaff-plugin-clear-requests/chaff-plugin.yaml"] = "apiVersion: 1\n";
    const run = await runCli({ ...files, "chaff.yaml": config("chaff-plugin-clear-requests"), "en.md": EN }, ["en.md", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.ok(reported(run.out).includes("clear-requests/vague-deadline"));
  });

  it("refuses a pack written for another plugin API", async () => {
    const files = packFiles("pack");
    files["pack/chaff-plugin.yaml"] = "apiVersion: 2\n";
    const run = await runCli({ ...files, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /it was written for plugin API 2/u);
  });
  it("reports a manifest that is not a map, and never falls back to running the package's code", async () => {
    const marker = join(tmpdir(), `chaff-pack-ran-${String(process.pid)}`);
    const files = {
      "node_modules/chaff-plugin-x/package.json": JSON.stringify({ name: "chaff-plugin-x", chaff: "yes", main: "index.mjs" }),
      "node_modules/chaff-plugin-x/index.mjs": `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nexport default {};\n`,
      "chaff.yaml": config("chaff-plugin-x"),
      "en.md": EN,
    };
    const run = await runCli(files, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /package\.json: chaff must be a map/u);
    assert.ok(!existsSync(marker), "the package's code did not run");
    const pack = packFiles("pack");
    pack["pack/chaff-plugin.yaml"] = "- apiVersion: 1\n";
    const listed = await runCli({ ...pack, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.match(listed.err, /chaff-plugin\.yaml: write a map \(apiVersion: 1\)/u);
  });

  it("refuses a pack file that links outside the pack", async () => {
    const root = mkdtempSync(join(tmpdir(), "chaff-pack-link-"));
    Object.entries(packFiles("pack")).forEach(([path, text]) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    });
    writeFileSync(join(root, "outside.yaml"), "id: x\n");
    symlinkSync(join(root, "outside.yaml"), join(root, "pack", "rules", "linked.yaml"));
    const run = await runCli({ "chaff.yaml": config(join(root, "pack")), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /rules\/linked\.yaml: it links to a file outside the pack/u);
  });

  it("refuses an empty word list rather than running a rule that can find nothing", async () => {
    const files = packFiles("pack");
    files["pack/lexicons/en/vague-deadline.yaml"] = "[]\n";
    const run = await runCli({ ...files, "chaff.yaml": config("./pack"), "en.md": EN }, ["en.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /cannot read the word list vague-deadline/u);
  });
});
