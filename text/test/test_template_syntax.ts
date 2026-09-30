import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, markdownOutline } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { componentLines, templateSpans } from "../packages/chaff/src/template-syntax.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// Template and MDX syntax in Markdown documentation is markup, not prose: it is blanked the way a code span is, keeping
// every offset. Text a construct wraps (an alert's body, an admonition's body, the text between JSX tags) is prose.

const build = (source: string, adapter: LanguageAdapter = en, path = "t.md") => buildDocument(path, source, adapter);

const texts = (source: string, adapter: LanguageAdapter = en, path = "t.md"): string[] =>
  build(source, adapter, path).sentences.map((sentence) => sentence.text.replace(/\s+/gu, " ").trim());

const headings = (source: string): string[] =>
  build(source)
    .sections.filter((section) => section.depth > 0)
    .map((section) => section.heading);

describe("Liquid and Jinja", () => {
  it("an inline variable is blanked, and the sentence around it stays one sentence", () => {
    assert.deepEqual(texts("Open {% data variables.product.name %} and pick a file."), ["Open and pick a file."]);
  });

  it("an output tag is blanked", () => {
    assert.deepEqual(texts("Open {{ site.title }} and pick a file. The {{- page.name -}} page loads."), ["Open and pick a file.", "The page loads."]);
  });

  it("control tags are blanked and the text they guard is prose", () => {
    const source = ["{% ifversion fpt %}", "You can pick a file.", "{% endif %}", "", "Images{% ifversion ghes %}, tables{% endif %} and files work."].join(
      "\n",
    );
    assert.deepEqual(texts(source), ["You can pick a file.", "Images , tables and files work."]);
  });

  it("a comment is blanked", () => {
    assert.deepEqual(texts("Pick a file.{# a note for the writer #} Then save it."), ["Pick a file.", "Then save it."]);
  });

  it("a tag alone in its paragraph leaves no sentence", () => {
    assert.deepEqual(texts("Pick a file.\n\n{% data reusables.files.picking %}\n\nThen save it."), ["Pick a file.", "Then save it."]);
  });

  it("a Japanese sentence keeps the words on both sides", () => {
    assert.deepEqual(texts("{{ site.name }}では、画像を使えます。", ja), ["では、画像を使えます。"]);
  });

  it("the offsets do not move", () => {
    const source = "Open {% data variables.product.name %} and pick a file.";
    const doc = build(source);
    assert.equal(doc.prose?.length, source.length);
    assert.deepEqual(
      doc.sentences.map((sentence) => sentence.span),
      [{ start: 0, end: source.length }],
    );
  });
});

describe("Hugo shortcodes", () => {
  it("the markers of a paired shortcode are blanked and its body is prose", () => {
    const source = ["{{< note >}}", "Save the file first.", "{{< /note >}}", "", '{{% alert title="Heads up" %}}', "Close the editor.", "{{% /alert %}}"].join(
      "\n",
    );
    assert.deepEqual(texts(source), ["Save the file first.", "Close the editor."]);
  });

  it("an inline shortcode is blanked", () => {
    assert.deepEqual(texts('Read {{< ref "setup.md" >}} before you start.'), ["Read before you start."]);
  });
});

describe("text that only looks like a tag", () => {
  it("braces in code do not open a tag", () => {
    const source = "Write `{{` to open a tag and `}}` to close it.";
    assert.deepEqual(texts(source), ["Write to open a tag and to close it."]);
  });

  it("an unclosed tag does not run past a blank line", () => {
    assert.deepEqual(texts("Type {{ to start.\n\nThen type }} to end."), ["Type {{ to start.", "Then type }} to end."]);
  });

  it("an opener closes at its first closer, and a later opener is read again after a failed one", () => {
    assert.deepEqual(texts("Type {{ and then {% if x %} to test."), ["Type {{ and then to test."]);
    assert.deepEqual(texts("Use {{a}}}} here."), ["Use }} here."]);
  });

  it("many unclosed openers on one line take linear time", () => {
    const line = Array.from({ length: 40_000 }, () => "{{x {%y {#z {/*w").join(" ");
    const started = performance.now();
    templateSpans(line);
    assert.ok(performance.now() - started < 1_000);
    assert.deepEqual(templateSpans(`${line} }}`), [{ start: 0, end: line.length + 3 }]);
  });

  it("agrees with the lazy regular expression it replaces, on generated text", () => {
    // The definition, fine for short text: each opener runs to its first closer, never past a blank line.
    const inside = String.raw`(?:(?!\n[ \t]*\n)[\s\S])*?`;
    const oracle = new RegExp(
      [String.raw`\{%${inside}%\}`, String.raw`\{\{${inside}\}\}`, String.raw`\{#${inside}#\}`, String.raw`\{\/\*${inside}\*\/\}`].join("|"),
      "gu",
    );
    const pieces = ["{", "}", "{{", "}}", "{%", "%}", "{#", "#}", "{/*", "*/}", "*/", "a", " ", "\n", "\n\n", "\n \t\n", "%", "#", "/", "*"];
    const SEED = 20_261_001;
    const state = { value: SEED };
    const random = (): number => {
      state.value = (state.value * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state.value / 2_147_483_648;
    };
    const text = (): string => Array.from({ length: 1 + Math.floor(random() * 30) }, () => pieces[Math.floor(random() * pieces.length)] ?? "").join("");
    Array.from({ length: 5_000 }, text).forEach((input) => {
      const expected = [...input.matchAll(oracle)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
      assert.deepEqual(templateSpans(input), expected, `seed ${String(SEED)}: ${JSON.stringify(input)}`);
    });
  });

  it("single braces are prose", () => {
    assert.deepEqual(texts("Set {name} to your name."), ["Set {name} to your name."]);
  });

  it("a text file is not read as a template", () => {
    assert.deepEqual(texts("Open {{ site.title }} now.", en, "t.txt"), ["Open {{ site.title }} now."]);
  });
});

describe("MDX", () => {
  it("import and export lines at the top level are not prose", () => {
    const source = [
      "import Tabs from '@theme/Tabs';",
      'import { Note } from "../components";',
      "",
      'import{Tabs}from "@theme/Tabs";',
      "",
      "export const meta = { title: 'Guide' };",
      "",
      "export default function Page(props) {",
      "  return props.children;",
      "}",
      "",
      "export default AdmonitionTypes;",
      "",
      "export default 'Guide';",
      "",
      "export default makePage({ title: 'Guide' });",
      "",
      "export default <Page />;",
      "",
      "export { Note } from './note';",
      "",
      "Pick a file.",
    ].join("\n");
    assert.deepEqual(texts(source), ["Pick a file."]);
  });

  it("the structure outline does not read an import or export either", () => {
    const source = 'export default "Section 9";\n\nSection 1. Text.';
    assert.deepEqual(markdownOutline(source).opaque, [{ start: 0, end: source.indexOf(";") + 1 }]);
  });

  it("a sentence that starts with Import or export is prose", () => {
    const source = [
      "Import the file from the menu.",
      "",
      "import duties rose from last year.",
      "",
      "export your data from the settings page.",
      "",
      "export default reports from the dashboard.",
      "",
      "export default value.",
      "",
      "import data from 'CSV' before review.",
      "",
      "- import Tabs from '@theme/Tabs';",
    ].join("\n");
    assert.deepEqual(texts(source), [
      "Import the file from the menu.",
      "import duties rose from last year.",
      "export your data from the settings page.",
      "export default reports from the dashboard.",
      "export default value.",
      "import data from 'CSV' before review.",
      "import Tabs from '@theme/Tabs';",
    ]);
  });

  it("the text inside a JSX element is prose, its tags are not", () => {
    const source = [
      '<Admonition type="note">',
      "Save the file first.",
      "</Admonition>",
      "",
      "<Tabs>",
      '  <TabItem value="a">Use the menu.</TabItem>',
      "</Tabs>",
    ].join("\n");
    assert.deepEqual(texts(source), ["Save the file first.", "Use the menu."]);
  });

  it("a tag whose attributes hold > or braces is still a tag", () => {
    const source = ['<Callout title="Use > settings" icon={<Icon />}>', "Save the file first.", "</Callout>", "", "Pick a file."].join("\n");
    assert.deepEqual(texts(source), ["Save the file first.", "Pick a file."]);
    const nested = ['<Tabs values={[{ label: "A", value: "a" }]}>', "Save the file first.", "</Tabs>", "", "Pick a file."].join("\n");
    assert.deepEqual(texts(nested), ["Save the file first.", "Pick a file."]);
    const deep = ['<Callout title={getTitle({ nested: { label: "A" } })} onClick={() => count > 1}>', "Save the file first.", "</Callout>"].join("\n");
    assert.deepEqual(texts(deep), ["Save the file first."]);
  });

  it("a line with unbalanced braces or text beside its tags is not a tag line", () => {
    ["<Note a={b>", "<Note a=b}>", "<Note>{", "<Note>}", "<Note>Save the file first.", "<Note> and <note>", "Save <Note>"].forEach((line) => {
      assert.deepEqual(componentLines(line), [], line);
    });
    const line = "  <Note a={{ b: 1 }} title='Use > here'> </Note>  ";
    assert.deepEqual(componentLines(`Text.\n${line}\nMore.`), [{ start: 6, end: 6 + line.length }]);
  });

  it("a tag line is blanked in the prose too", () => {
    const prose = build('<Callout title="Save first">\nPick a file.\n</Callout>').prose ?? "";
    assert.equal(prose.trim(), "Pick a file.");
  });

  it("a tag line ends at its own line", () => {
    ["<Tip\n", "<Tip title\n"].forEach((opening) => {
      assert.match(texts(`${opening}Save the file first. Then pick the next ->`).join(" "), /Save the file first\./u, opening);
    });
  });

  it("an HTML block stays opaque", () => {
    assert.deepEqual(texts(["<div>", "Save the file first.", "</div>", "", "Pick a file."].join("\n")), ["Pick a file."]);
  });

  it("an MDX comment is blanked, in a paragraph and in a heading", () => {
    const source = ["## Usage with Prettier {/* #usage */}", "", "{/* prettier-ignore */}", "Pick a file."].join("\n");
    assert.deepEqual(headings(source), ["Usage with Prettier"]);
    assert.deepEqual(texts(source), ["Pick a file."]);
  });
});

describe("headings", () => {
  it("template syntax is not part of a heading", () => {
    assert.deepEqual(headings("## About {% data variables.product.name %}\n\nText.\n\n## Using {{ site.title }} well\n\nText."), ["About", "Using well"]);
  });

  it("a heading of nothing but a tag still starts a section", () => {
    assert.equal(build("Lead.\n\n## {{ product.name }}\n\nText.").sections.length, 2);
  });

  it("the outline reads the same headings", () => {
    assert.deepEqual(
      markdownOutline("## Setup {/* #setup */}\n\nText.").headings.map((heading) => heading.text),
      ["Setup"],
    );
  });
});

describe("GitHub alerts", () => {
  it("the body of an alert is prose, its marker and quote marks are not", () => {
    const source = ["> [!NOTE]", "> Save the file first.", "> Then close the editor.", "", "Pick a file."].join("\n");
    assert.deepEqual(texts(source), ["Save the file first.", "Then close the editor.", "Pick a file."]);
  });

  it("every alert type and a lower-case marker are alerts", () => {
    ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION", "note"].forEach((type) => {
      assert.deepEqual(texts(`> [!${type}]\n> Save the file first.`), ["Save the file first."], type);
    });
  });

  it("a paragraph after a blank quote line is prose too", () => {
    assert.deepEqual(texts("> [!TIP]\n> Save first.\n>\n> Then close it."), ["Save first.", "Then close it."]);
  });

  it("a plain quote is still not prose", () => {
    assert.deepEqual(texts("> Somebody else wrote this.\n\nPick a file."), ["Pick a file."]);
  });

  it("a quote inside an alert is still a quote, even one that opens like an alert", () => {
    assert.deepEqual(texts("> [!NOTE]\n> Save first.\n>\n> > Somebody else wrote this."), ["Save first."]);
    assert.deepEqual(texts("> [!NOTE]\n> Save first.\n>\n> > [!TIP]\n> > Somebody else wrote this."), ["Save first."]);
  });

  it("an alert inside a plain quote is quoted", () => {
    assert.deepEqual(texts("> Somebody wrote:\n>\n> > [!TIP]\n> > Keep it short.\n\nPick a file."), ["Pick a file."]);
  });

  it("alerts one after another are each read", () => {
    assert.deepEqual(texts("> [!NOTE]\n> Save first.\n\n> [!TIP]\n> Close it."), ["Save first.", "Close it."]);
  });

  it("an alert in a list item keeps its body", () => {
    assert.deepEqual(texts("- Step one.\n\n  > [!NOTE]\n  > Save first."), ["Step one.", "Save first."]);
  });
});

describe("admonitions", () => {
  it("the marker lines are not prose and the body is", () => {
    assert.deepEqual(texts(":::note Take care\n\nSave the file first.\n\n:::"), ["Save the file first."]);
  });

  it("an indented admonition in a list item is read the same way", () => {
    assert.deepEqual(texts("- Step one.\n\n  :::tip\n  Save the file first.\n  :::"), ["Step one.", "Save the file first."]);
  });
});
