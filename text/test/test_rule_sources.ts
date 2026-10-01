import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { ruleGuideOf } from "../packages/chaff/src/rule-guide.ts";
import { entriesOf } from "../site/src/lib/bibliographyEntries.ts";

// A rule page links each of the rule's sources to its entry on the bibliography page.
// An id the page does not have would break the site build, so it is caught here first.

const GUIDE = join(import.meta.dirname, "..", "site", "src", "content", "guide");
const idsOf = (lang: string): string[] => entriesOf(readFileSync(join(GUIDE, lang, "bibliography.md"), "utf8")).map((entry) => entry.id);

describe("rule sources — the bibliography entries a rule rests on", () => {
  it("reads an entry's anchor and its bold label", () => {
    const markdown = ["# Bibliography", "", '- <a id="femmer-2017"></a>**Femmer et al. (2017)** [doi.org](https://doi.org/x)', "  - Found: ..."].join("\n");
    assert.deepEqual(entriesOf(markdown), [{ id: "femmer-2017", label: "Femmer et al. (2017)" }]);
  });

  it("reads nothing from a list item without an anchor, or an anchor not at the start", () => {
    assert.deepEqual(entriesOf('- **Femmer et al. (2017)**\nsee also - <a id="x"></a>**y**\n'), []);
  });

  it("reads sources as a list of ids, and nothing from anything else", () => {
    assert.deepEqual(ruleGuideOf({ sources: ["femmer-2017", "", 3] }).sources, ["femmer-2017"]);
    assert.deepEqual(ruleGuideOf({ sources: "femmer-2017" }).sources, []);
    assert.deepEqual(ruleGuideOf({}).sources, []);
  });

  it("the Japanese and English bibliographies have the same entries, in the same order", () => {
    assert.deepEqual(idsOf("ja"), idsOf("en"));
  });

  it("every source a rule names is an entry of the bibliography", () => {
    const known = new Set(idsOf("en"));
    const missing = loadRules("en").flatMap((rule) => (rule.guide?.sources ?? []).filter((id) => !known.has(id)).map((id) => `${rule.id}: ${id}`));
    assert.deepEqual(missing, []);
  });
});
