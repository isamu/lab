import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// Reference-link definitions that do nothing. Self-written examples.

const unused = (source: string, adapter = en, path = "a.md"): readonly string[] =>
  namedRuleRun("link-definition-unused", `${source}\n`, adapter, path).findings;

describe("link-definition-unused", () => {
  it("reports a definition no link calls", () => {
    assert.deepEqual(unused("See the [guide][guide].\n\n[guide]: https://example.com/guide\n[form]: https://example.com/form"), [
      'No link uses the definition "form"',
    ]);
    assert.deepEqual(unused("[案内][guide]を見てください。\n\n[guide]: https://example.com/guide\n[申込書]: https://example.com/form", ja), [
      "リンクの定義「申込書」を使うリンクがありません",
    ]);
  });

  it("reports a definition whose link was mistyped, which leaves the link as text", () => {
    assert.deepEqual(unused("Send the [form][from].\n\n[form]: https://example.com/form"), ['No link uses the definition "form"']);
  });

  it("reports a second definition of a label with another address", () => {
    assert.deepEqual(unused("See the [guide].\n\n[guide]: https://example.com/a\n[guide]: https://example.com/b"), [
      '"guide" is already defined (https://example.com/a); this address is never used',
    ]);
    assert.deepEqual(unused("[案内]を見てください。\n\n[案内]: https://example.com/a\n[案内]: https://example.com/b", ja), [
      "「案内」は前にも定義されていて（https://example.com/a）、この行き先は使われません",
    ]);
  });

  it("counts every way of calling a definition, whatever the case of the label", () => {
    assert.deepEqual(
      unused("A [full][g], a [collapsed][], a [shortcut], an ![image][logo] and [Upper][G].\n\n[g]: /g\n[collapsed]: /c\n[shortcut]: /s\n[logo]: /l.png"),
      [],
    );
    assert.deepEqual(unused("> Quoted: see the [guide].\n\n[guide]: https://example.com/guide"), []);
  });

  it("does not report a repeated definition with the same address, notes, comments or heading anchors", () => {
    assert.deepEqual(unused("See the [guide].\n\n[guide]: https://example.com/a\n[guide]: https://example.com/a"), []);
    assert.deepEqual(unused("A claim.[^1]\n\n[^1]: The note."), []);
    assert.deepEqual(unused("Text.\n\n[//]: # (a note to the editor)\n\n[comment]: <> (another note)"), []);
    assert.deepEqual(unused("# Summary\n[summary]: #summary\n\nThe proposal in short."), []);
  });

  it("does not report a file of nothing but definitions, quoted definitions, code, or a plain-text file", () => {
    assert.deepEqual(unused("[guide]: https://example.com/guide\n[form]: https://example.com/form"), []);
    assert.deepEqual(unused("Text.\n\n> [guide]: https://example.com/guide"), []);
    assert.deepEqual(unused("Text.\n\n```\n[guide]: https://example.com/guide\n```"), []);
    assert.deepEqual(unused("Text.\n\n[guide]: https://example.com/guide", en, "a.txt"), []);
  });
});
