import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { installPinMismatches, installShape, ownTextOf, pinsIn } from "../packages/chaff/src/structure/install-pin.ts";
import { releasesOf } from "../packages/chaff/src/structure/release-list.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// An install command that pins the document's own package to a version its release list does not say is current
// (version-mismatch, variants newest and section). The documents are self-written.

const RULE = "version-mismatch";
const FENCE = "```";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("README.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.variant)} ${String(finding.values["pinned"])}>${String(finding.values["release"])}`);

const readme = (title: string, opening: string, command: string, releases: readonly string[]): string =>
  [`# ${title}`, "", opening, "", "## Install", "", `${FENCE}bash`, command, FENCE, "", "## Changes", "", ...releases, ""].join("\n");

const RELEASES = ["- 3.2.0 (2026-09-14): wide characters.", "- 3.1.0 (2026-06-02): hyphenation.", "- 3.0.0 (2026-03-20): prefix."];
const RELEASES_JA = ["- 3.2.0（2026-09-14）：全角文字。", "- 3.1.0（2026-06-02）：ハイフン。", "- 3.0.0（2026-03-20）：prefix。"];

const changelog = (opening: string, pinUnder: string, command: string): string =>
  [
    "# Changelog",
    "",
    opening,
    "",
    ...["3.2.0", "3.1.0", "3.0.0"].flatMap((version) => [
      `## ${version} - 2026-01-01`,
      "",
      version === pinUnder ? `- Install with \`${command}\`.` : "- Fixes.",
      "",
    ]),
  ].join("\n");

before(async () => prepare());

describe("version-mismatch: an install pin against the release list", () => {
  it("en: a README pinning its own package to a release older than the newest it lists", () => {
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@3.1.0", RELEASES), en), ["8 newest 3.1.0>3.2.0"]);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@3.2.0", RELEASES), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "pip install wrapkit==3.0.0", RELEASES), en), ["8 newest 3.0.0>3.2.0"]);
    assert.deepEqual(found(readme("wrapkit", "Wraps text.", "npm install --save-dev wrapkit@3.1.0", RELEASES), en), ["8 newest 3.1.0>3.2.0"]);
  });

  it("ja: 自分のパッケージを、一覧で最新でない版に固定する", () => {
    assert.deepEqual(found(readme("wrapkit", "wrapkit は文章を折り返します。", "npm install wrapkit@3.1.0", RELEASES_JA), ja), ["8 newest 3.1.0>3.2.0"]);
    assert.deepEqual(found(readme("wrapkit", "wrapkit は文章を折り返します。", "npm install wrapkit@3.2.0", RELEASES_JA), ja), []);
  });

  it("a changelog: a pin under a release's heading is compared with that release; the opening paragraph names the package", () => {
    assert.deepEqual(found(changelog("All notable changes to wrapkit.", "3.2.0", "npm install wrapkit@3.1.0"), en), ["7 section 3.1.0>3.2.0"]);
    assert.deepEqual(found(changelog("All notable changes to wrapkit.", "3.0.0", "npm install wrapkit@3.0.0"), en), []);
    assert.deepEqual(found(changelog("wrapkit の主な変更を記録します。", "3.2.0", "npm install wrapkit@3.1.1"), ja), ["7 section 3.1.1>3.2.0"]);
    assert.deepEqual(found(changelog("wrapkit の主な変更を記録します。", "3.1.0", "npm install wrapkit@3.1.0"), ja), []);
  });

  it("is silent on another package's pin, a range, a tag, a prerelease, and a document with no release list", () => {
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install react@18.2.0", RELEASES), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@^3.0.0", RELEASES), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "pip install wrapkit>=3.0.0", RELEASES), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@latest", RELEASES), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@4.0.0-beta.1", RELEASES), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@3.1.0", ["- Wide characters.", "- Hyphenation."]), en), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit は文章を折り返します。", "npm install react@18.2.0", RELEASES_JA), ja), []);
    assert.deepEqual(found(readme("wrapkit", "wrapkit は文章を折り返します。", "npm install wrapkit@3.1.0", ["- 全角文字。"]), ja), []);
  });

  it("takes the title's package over one the opening paragraph names, and leaves a package neither names", () => {
    assert.deepEqual(found(readme("wrapkit", "A React wrapper for wrapkit.", "npm install react@18.2.0 wrapkit@3.1.0", RELEASES), en), [
      "8 newest 3.1.0>3.2.0",
    ]);
    assert.deepEqual(found(readme("Text tools", "Tools for text.", "npm install wrapkit@3.1.0", RELEASES), en), []);
  });

  it("reads a pin at the end of a sentence; a scoped package is not the one its last part names", () => {
    const sentence = ["# wrapkit", "", "wrapkit wraps text.", "", "Install with npm install wrapkit@3.1.0.", "", ...RELEASES, ""].join("\n");
    assert.deepEqual(found(sentence, en), ["5 newest 3.1.0>3.2.0"]);
    assert.deepEqual(found(readme("react", "react hooks.", "npm install @types/react@3.1.0", RELEASES), en), []);
    assert.deepEqual(found(readme("@wrapkit/core", "Wraps text.", "npm install @wrapkit/core@3.1.0", RELEASES), en), ["8 newest 3.1.0>3.2.0"]);
  });

  it("takes version headings as a release list only when nothing else stands between them", () => {
    const manual = [
      "# wrapkit",
      "",
      "wrapkit wraps text.",
      "",
      "## 2.0.0 API",
      "",
      "Calls.",
      "",
      "## Install",
      "",
      "npm install wrapkit@1.0.0",
      "",
      "## 1.0.0 Config",
      "",
      "Settings.",
      "",
    ];
    assert.deepEqual(found(manual.join("\n"), en), []);
  });

  it("does not take a prerelease as the newest, nor a release list inside a code block", () => {
    const releases = ["- 4.0.0-beta.1 (2026-10-01): preview.", ...RELEASES];
    assert.deepEqual(found(readme("wrapkit", "wrapkit wraps text.", "npm install wrapkit@3.2.0", releases), en), []);
    const fenced = ["# wrapkit", "", "wrapkit wraps text.", "", `${FENCE}bash`, "npm install wrapkit@3.1.0", FENCE, "", `${FENCE}md`, ...RELEASES, FENCE, ""];
    assert.deepEqual(found(fenced.join("\n"), en), []);
  });
});

describe("installShape and pinsIn", () => {
  it("reads every pin after the command, up to the end of the command", () => {
    const shapes = ["npm install {name}@{version}", "gem install {name} -v {version}"];
    const pins = (text: string): string[] =>
      pinsIn(text, shapes).map((pin) => `${pin.name} ${pin.version} ${text.slice(pin.offset, pin.offset + pin.version.length)}`);
    assert.deepEqual(pins("npm install -g a@1.0.0 @s/b@2.0.0"), ["a 1.0.0 1.0.0", "@s/b 2.0.0 2.0.0"]);
    assert.deepEqual(pins("npm install a && npm test b@1.0.0"), []);
    assert.deepEqual(pins("`npm install a` then b@1.0.0"), []);
    assert.deepEqual(pins("gem install wrapkit -v 3.1.0"), ["wrapkit 3.1.0 3.1.0"]);
    assert.deepEqual(pins("npm installer a@1.0.0"), []);
    assert.deepEqual(pins("npm install a@1.0.0.1"), []);
  });

  it("rejects a shape without a command, a name or a version", () => {
    assert.equal(installShape("{name}@{version}"), undefined);
    assert.equal(installShape("npm install {name}"), undefined);
    assert.equal(installShape(""), undefined);
    assert.deepEqual(pinsIn("npm install a@1.0.0", ["", "npm install"]), []);
  });
});

describe("installPinMismatches", () => {
  const own = { title: "wrapkit", opening: "" };
  const pin = { offset: 5, name: "wrapkit", version: "3.1.0" };

  it("says nothing without pins, releases, or a stable release", () => {
    assert.deepEqual(installPinMismatches([], [{ version: "3.2.0", start: 0, end: 1 }], own), []);
    assert.deepEqual(installPinMismatches([pin], [], own), []);
    assert.deepEqual(installPinMismatches([pin], [{ version: "4.0.0-rc.1", start: 100, end: 120 }], own), []);
  });

  it("compares by version order, not by place in the list, and with the innermost section", () => {
    const releases = [
      { version: "3.10.0", start: 100, end: 110 },
      { version: "3.9.0", start: 120, end: 130 },
    ];
    assert.deepEqual(installPinMismatches([pin], releases, own), [{ offset: 5, variant: "newest", values: { pinned: "3.1.0", release: "3.10.0" } }]);
    const sections = [
      { version: "3.2.0", start: 0, end: 50 },
      { version: "3.1.0", start: 2, end: 9 },
    ];
    assert.deepEqual(installPinMismatches([pin], sections, own), []);
  });
});

describe("releasesOf and ownTextOf", () => {
  it("keeps a run of version headings with their sections, and drops section numbers", () => {
    const source = "## 3.2.0\n\nA\n\n### Added\n\nB\n\n## 3.1.0\n\nC\n";
    const headings = [
      { depth: 2, text: "3.2.0", start: 0, end: 8 },
      { depth: 3, text: "Added", start: 13, end: 22 },
      { depth: 2, text: "3.1.0", start: 27, end: 35 },
    ];
    assert.deepEqual(releasesOf(source, headings, []), [
      { version: "3.2.0", start: 0, end: 27 },
      { version: "3.1.0", start: 27, end: source.length },
    ]);
    assert.deepEqual(
      releasesOf(
        "",
        [
          { depth: 2, text: "1.2.1 Scope", start: 0, end: 1 },
          { depth: 2, text: "1.2.2 Terms", start: 2, end: 3 },
        ],
        [],
      ),
      [],
    );
    assert.deepEqual(
      releasesOf("- [v3.2.0] x\n- [v3.1.0] y\n", [], []).map((release) => release.version),
      ["3.2.0", "3.1.0"],
    );
  });

  it("reads the title and the opening paragraph, or nothing when a heading comes first", () => {
    assert.deepEqual(ownTextOf("# wrapkit\n\nWraps text.\nMore.\n\nLater.", [{ depth: 1, text: "wrapkit", end: 9 }]), {
      title: "wrapkit",
      opening: "Wraps text.\nMore.",
    });
    assert.deepEqual(ownTextOf("# Changelog\n\n## 3.2.0\n", [{ depth: 1, text: "Changelog", end: 11 }]), { title: "Changelog", opening: "" });
    assert.deepEqual(ownTextOf("", []), { title: "", opening: "" });
  });
});
