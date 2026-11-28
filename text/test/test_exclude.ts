import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { ignoreLayers, ignoreOf, isGitIgnored, projectRootOf, type IgnoreAt, type KindAt } from "../packages/chaff/src/gitignore.ts";
import { collectFiles } from "../packages/chaff/src/files.ts";
import { configOf } from "../packages/chaff/src/config/load.ts";
import { renderExcluded } from "../packages/chaff/src/render/summary.ts";
import { runCli } from "./cli-run.ts";

/** The ignore files of a tree, by folder ("" for the root). */
const layers =
  (files: Readonly<Record<string, string>>): IgnoreAt =>
  (folder) => {
    const text = files[folder];
    return text === undefined ? undefined : ignoreOf(text);
  };

describe("isGitIgnored: git's semantics", () => {
  it("a plain name matches at any depth, a leading slash anchors it to its folder", () => {
    const at = layers({ "": "draft.md\n/top.md\n" });
    assert.equal(isGitIgnored("draft.md", at), true);
    assert.equal(isGitIgnored("a/b/draft.md", at), true);
    assert.equal(isGitIgnored("top.md", at), true);
    assert.equal(isGitIgnored("a/top.md", at), false);
  });

  it("a pattern with a slash in the middle is anchored too", () => {
    const at = layers({ "": "docs/old.md\n" });
    assert.equal(isGitIgnored("docs/old.md", at), true);
    assert.equal(isGitIgnored("x/docs/old.md", at), false);
  });

  it("a trailing slash matches folders only", () => {
    const at = layers({ "": "notes/\n" });
    assert.equal(isGitIgnored("notes/a.md", at), true);
    assert.equal(isGitIgnored("x/notes/a.md", at), true);
    assert.equal(isGitIgnored("notes", at), false);
  });

  it("! re-includes a file the same or a shallower file ignored", () => {
    const at = layers({ "": "*.md\n!keep.md\n" });
    assert.equal(isGitIgnored("a.md", at), true);
    assert.equal(isGitIgnored("keep.md", at), false);
    assert.equal(isGitIgnored("x/keep.md", at), false);
  });

  it("a file inside an ignored folder stays ignored whatever ! says", () => {
    const at = layers({ "": "build-out/\n!build-out/keep.md\n" });
    assert.equal(isGitIgnored("build-out/keep.md", at), true);
    const deeper = layers({ "": "vendor/\n", vendor: "!keep.md\n" });
    assert.equal(isGitIgnored("vendor/keep.md", deeper), true);
  });

  it("a deeper .gitignore applies below its own folder and overrides a shallower one", () => {
    const at = layers({ "": "*.tmp.md\n", docs: "private.md\n!x.tmp.md\n" });
    assert.equal(isGitIgnored("docs/private.md", at), true);
    assert.equal(isGitIgnored("private.md", at), false);
    assert.equal(isGitIgnored("docs/x.tmp.md", at), false);
    assert.equal(isGitIgnored("y.tmp.md", at), true);
  });

  it("comments, blank lines and an escaped # are read as git reads them", () => {
    const at = layers({ "": "# a comment\n\n\\#hash.md\n" });
    assert.equal(isGitIgnored("# a comment", at), false);
    assert.equal(isGitIgnored("#hash.md", at), true);
  });

  it("nothing is ignored without any .gitignore, or with an empty one", () => {
    assert.equal(isGitIgnored("a/b.md", layers({})), false);
    assert.equal(isGitIgnored("a/b.md", layers({ "": "" })), false);
  });
});

/** An absolute path on this system, so the tests read the same on Windows. */
const abs = (...parts: string[]): string => join(resolve("/"), ...parts);

/** A file system of folders and files, by absolute path. */
const kinds =
  (entries: Readonly<Record<string, "folder" | "file">>): KindAt =>
  (path) =>
    entries[path];

describe("projectRootOf", () => {
  it("is the nearest folder above holding a .git folder", () => {
    assert.deepEqual(projectRootOf(abs("repo", "docs", "a"), kinds({ [abs("repo", ".git")]: "folder" }), undefined), { root: abs("repo"), gitFolder: true });
  });

  it("takes a worktree's .git file, and says it is not a folder", () => {
    assert.deepEqual(projectRootOf(abs("wt", "docs"), kinds({ [abs("wt", ".git")]: "file", [abs("repo", ".git")]: "folder" }), abs("wt")), {
      root: abs("wt"),
      gitFolder: false,
    });
  });

  it("without a repository, chaff.yaml's folder when it holds the checked folder, else the checked folder", () => {
    assert.deepEqual(projectRootOf(abs("proj", "docs"), kinds({}), abs("proj")), { root: abs("proj"), gitFolder: false });
    assert.deepEqual(projectRootOf(abs("proj", "docs"), kinds({}), abs("elsewhere")), { root: abs("proj", "docs"), gitFolder: false });
    assert.deepEqual(projectRootOf(abs("proj", "docs"), kinds({}), undefined), { root: abs("proj", "docs"), gitFolder: false });
  });
});

describe("ignoreLayers", () => {
  const texts =
    (entries: Readonly<Record<string, string>>) =>
    (path: string): string | undefined =>
      entries[path];

  it("applies the root .gitignore to a file in a subfolder, and a nested one below its folder", () => {
    const at = ignoreLayers(
      { root: abs("repo"), gitFolder: true },
      texts({ [abs("repo", ".gitignore")]: "drafts/\n", [abs("repo", "docs", ".gitignore")]: "old.md\n" }),
    );
    assert.equal(isGitIgnored("docs/drafts/a.md", at), true);
    assert.equal(isGitIgnored("docs/old.md", at), true);
    assert.equal(isGitIgnored("old.md", at), false);
  });

  it("reads .git/info/exclude when .git is a folder, below the root .gitignore", () => {
    const files = { [abs("repo", ".git", "info", "exclude")]: "local.md\nkeep.md\n", [abs("repo", ".gitignore")]: "!keep.md\n" };
    const at = ignoreLayers({ root: abs("repo"), gitFolder: true }, texts(files));
    assert.equal(isGitIgnored("local.md", at), true);
    assert.equal(isGitIgnored("keep.md", at), false);
  });

  it("does not look for .git/info/exclude when .git is a worktree's file, or with no repository", () => {
    const files = { [abs("wt", ".git", "info", "exclude")]: "local.md\n" };
    assert.equal(isGitIgnored("local.md", ignoreLayers({ root: abs("wt"), gitFolder: false }, texts(files))), false);
  });
});

const tree = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "chaff-exclude-"));
  Object.entries(files).forEach(([name, body]) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), body);
  });
  return root;
};

const names = (root: string, paths: readonly string[]): string[] =>
  paths.map((path) => relative(root, path).split(sep).join("/")).toSorted((one, other) => one.localeCompare(other, "en"));

describe("collectFiles: exclude and .gitignore", () => {
  const files = {
    "chaff.yaml": "exclude: [vendor/**, CHANGELOG.md]\n",
    ".gitignore": "drafts/\n",
    "README.md": "# r\n",
    "CHANGELOG.md": "# c\n",
    "docs/CHANGELOG.md": "# c\n",
    "vendor/lib/README.md": "# v\n",
    "drafts/a.md": "# d\n",
    "docs/guide.md": "# g\n",
  };

  it("leaves out what exclude and .gitignore name, and counts each", () => {
    const root = tree(files);
    const config = configOf({ exclude: ["vendor/**", "CHANGELOG.md"] }, join(root, "chaff.yaml"));
    const found = collectFiles([root], [], config);
    assert.deepEqual(names(root, found.paths), ["docs/CHANGELOG.md", "docs/guide.md", "README.md"]);
    assert.deepEqual(found.excluded, { config: 2, gitignore: 1 });
  });

  it("still checks a file named on the command line", () => {
    const root = tree(files);
    const config = configOf({ exclude: ["vendor/**", "CHANGELOG.md"] }, join(root, "chaff.yaml"));
    const found = collectFiles([join(root, "CHANGELOG.md"), join(root, "drafts", "a.md"), root], [], config);
    assert.deepEqual(names(root, found.paths), ["CHANGELOG.md", "docs/CHANGELOG.md", "docs/guide.md", "drafts/a.md", "README.md"]);
    assert.deepEqual(found.excluded, { config: 1, gitignore: 0 });
  });

  it("in a repository, a subfolder run reads the .gitignore files from the repository's root down", () => {
    const root = tree({ ...files, ".git/HEAD": "ref: refs/heads/main\n", "docs/.gitignore": "guide.md\n" });
    const found = collectFiles([join(root, "drafts"), join(root, "docs")]);
    assert.deepEqual(names(root, found.paths), ["docs/CHANGELOG.md"]);
    assert.deepEqual(found.excluded, { config: 0, gitignore: 2 });
  });

  it("outside a repository, chaff.yaml's folder is the root when it holds the checked folder", () => {
    const root = tree(files);
    const config = configOf({}, join(root, "chaff.yaml"));
    assert.deepEqual(names(root, collectFiles([join(root, "drafts")], [], config).paths), []);
  });

  it("with neither a repository nor chaff.yaml, the checked folder is the root", () => {
    const root = tree(files);
    assert.deepEqual(names(root, collectFiles([join(root, "drafts")]).paths), ["drafts/a.md"]);
  });

  it("applies to a glob too, from the glob's fixed folder", () => {
    const root = tree(files);
    const found = collectFiles([join(root, "*", "*.md")]);
    assert.deepEqual(
      found.paths.map((path) => basename(path)).toSorted((one, other) => one.localeCompare(other, "en")),
      ["CHANGELOG.md", "guide.md"],
    );
    assert.deepEqual(found.excluded, { config: 0, gitignore: 1 });
  });

  it("without exclude or .gitignore, finds what it always found", () => {
    const root = tree({ "a.md": "# a\n", "b/c.md": "# c\n" });
    assert.deepEqual(names(root, collectFiles([root]).paths), ["a.md", "b/c.md"]);
    assert.deepEqual(collectFiles([root]).excluded, { config: 0, gitignore: 0 });
  });
});

describe("chaff.yaml exclude", () => {
  it("reads a list or one glob", () => {
    assert.deepEqual(configOf({ exclude: ["a/**", "b.md"] }, "/x/chaff.yaml").exclude, ["a/**", "b.md"]);
    assert.deepEqual(configOf({ exclude: "a/**" }, "/x/chaff.yaml").exclude, ["a/**"]);
    assert.deepEqual(configOf({}, "/x/chaff.yaml").exclude, []);
  });
});

describe("the summary says what was left out and why", () => {
  it("in both languages, and nothing when nothing was left out", () => {
    assert.deepEqual(renderExcluded({ config: 2, gitignore: 1 }, "en"), ["  3 files not checked (2 by exclude in chaff.yaml, 1 by .gitignore)"]);
    assert.deepEqual(renderExcluded({ config: 0, gitignore: 4 }, "ja"), ["  検査から外したファイル: 4 件（.gitignore で 4 件）"]);
    assert.deepEqual(renderExcluded({ config: 0, gitignore: 0 }, "en"), []);
  });

  it("end to end", async () => {
    const run = await runCli(
      { "chaff.yaml": "exclude: [vendor/**]\n", ".gitignore": "drafts/\n", "a.md": "# A\n\nText.\n", "vendor/b.md": "# B\n", "drafts/c.md": "# C\n" },
      ["."],
      "en_US.UTF-8",
    );
    assert.match(run.out, /2 files not checked \(1 by exclude in chaff\.yaml, 1 by \.gitignore\)/u);
    assert.doesNotMatch(run.out, /vendor|drafts/u);
  });

  it("says so when every file was left out", async () => {
    const run = await runCli({ "chaff.yaml": "exclude: ['**']\n", "a.md": "# A\n" }, ["."], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /1 file not checked \(1 by exclude in chaff\.yaml\)/u);
  });
});
