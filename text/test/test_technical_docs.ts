import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { codeFences, codeSpans, fenceOf, languageOf } from "../packages/chaff/src/detectors/code-fences.ts";
import { commandsIn, isStatement, minorityOf, promptStyleOf, showsCommand } from "../packages/chaff/src/detectors/technical-docs.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A README's or a manual's own checks: code fences with and without a language, shell prompts, a heading's command in
// its section's code, and a statement among numbered instructions. Every example is self-written.

const findingsOf = (adapter: LanguageAdapter, rule: string, source: string, genre = "docs/manual"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre).findings.filter((finding) => finding.rule === rule);

const fence = (language: string, ...lines: string[]): string => ["```" + language, ...lines, "```"].join("\n");
const doc = (...blocks: string[]): string => ["# Usage", "", ...blocks.flatMap((block) => [block, ""])].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("code fences and spans", () => {
  it("reads a fence's language from its info string", () => {
    assert.equal(fenceOf("```bash title=x")?.info, "bash title=x");
    assert.equal(languageOf("bash title=x"), "bash");
    assert.equal(languageOf("{r}"), "r");
    assert.equal(languageOf("{.python .numberLines}"), "python");
    assert.equal(fenceOf("``x``"), undefined);
    assert.equal(fenceOf("```js```"), undefined);
  });

  it("finds fenced blocks, closed by the same mark at least as long, and not inside a quotation", () => {
    const source = ["````js", "a", "```", "b", "`````", "> ```sh", "> c", "~~~~", "d", "~~~", "~~~~"].join("\n");
    assert.deepEqual(
      codeFences(source).map((block) => [block.language, block.lines]),
      [
        ["js", ["a", "```", "b"]],
        ["", ["d", "~~~"]],
      ],
    );
  });

  it("runs an unclosed fence to the end", () =>
    assert.deepEqual(
      codeFences("```sh\nnpm test").map((block) => block.lines),
      [["npm test"]],
    ));

  it("reads a fence inside a list item, and not an indented code block", () => {
    const source = ["1. Install it.", "", "   ```bash", "   npm install", "   ```", "", "Text.", "", "    ```", "    shown as text", "    ```"].join("\n");
    assert.deepEqual(
      codeFences(source).map((block) => [block.language, block.lines]),
      [["bash", ["npm install"]]],
    );
  });

  it("finds inline code spans of any backtick run", () => {
    assert.deepEqual(
      codeSpans("Run `npm test` or ``a ` b``, not `this").map((span) => span.text),
      ["npm test", "a ` b"],
    );
  });
});

describe("code-fence-language-mix: a block without a language among blocks with one", () => {
  it("reports the few untagged blocks", () => {
    const source = doc(fence("bash", "npm install"), fence("yaml", "a: 1"), fence("", "npx chaffjs"));
    assert.equal(findingsOf(en, "code-fence-language-mix", source).length, 1);
  });

  it("does not report more untagged blocks than the limit", () => {
    const tagged = [1, 2, 3, 4].map((index) => fence("bash", `step ${String(index)}`));
    assert.deepEqual(findingsOf(en, "code-fence-language-mix", doc(...tagged, fence("", "a"), fence("", "b"), fence("", "c"))), []);
  });

  it("never reports a tagged block, even when tagged blocks are the fewer", () =>
    assert.deepEqual(findingsOf(en, "code-fence-language-mix", doc(fence("", "a"), fence("", "b"), fence("", "c"), fence("bash", "d"))), []));

  it("reports nothing when the untagged blocks are as many, or there are none", () => {
    assert.deepEqual(findingsOf(en, "code-fence-language-mix", doc(fence("bash", "a"), fence("", "b"))), []);
    assert.deepEqual(findingsOf(en, "code-fence-language-mix", doc(fence("bash", "a"), fence("sh", "b"))), []);
  });

  it("takes the minority only up to the limit", () => {
    assert.deepEqual(minorityOf([1, 2, 3], [4, 5, 6, 7], 2), []);
    assert.deepEqual(minorityOf([1, 2], [4, 5, 6], 2), [1, 2]);
    assert.deepEqual(minorityOf([4, 5, 6], [1], 2), [1]);
  });

  it("does not run in a business genre", () =>
    assert.deepEqual(findingsOf(en, "code-fence-language-mix", doc(fence("bash", "a"), fence("sh", "b"), fence("", "c")), "business/report"), []));
});

describe("shell-prompt-mix: commands with and without a prompt", () => {
  const prompts = ["$", "%"];
  const block = (...lines: string[]) => ({ start: 0, language: "bash", lines, end: 0 });

  it("reads a block as prompted, bare, or a session with output", () => {
    assert.equal(promptStyleOf(block("$ npm install", "# a comment", "$ npm test"), prompts), "prompt");
    assert.equal(promptStyleOf(block("npm install"), prompts), "bare");
    assert.equal(promptStyleOf(block("$ node -v", "v24.0.0"), prompts), undefined);
    assert.equal(promptStyleOf(block("$PATH=/bin run"), prompts), "bare");
  });

  it("reports the block in the minority style, in both languages", () => {
    const blocks = [fence("bash", "npm install"), fence("sh", "npm test"), fence("bash", "$ npx chaffjs")];
    assert.equal(findingsOf(en, "shell-prompt-mix", doc(...blocks)).length, 1);
    assert.equal(findingsOf(ja, "shell-prompt-mix", ["# 使い方", "", ...blocks.flatMap((text) => [text, ""])].join("\n")).length, 1);
  });

  it("does not compare a block in another language or a session", () => {
    const blocks = [fence("bash", "npm install"), fence("sh", "npm test"), fence("python", "$ x = 1"), fence("console", "$ node -v", "v24")];
    assert.deepEqual(findingsOf(en, "shell-prompt-mix", doc(...blocks)), []);
  });
});

describe("heading-command-missing: a heading's command in its section's code", () => {
  it("reads flags and commands with arguments from a heading, not single words or links", () => {
    assert.deepEqual(commandsIn("## `--dry-run` and --force"), ["--dry-run", "--force"]);
    assert.deepEqual(commandsIn("## `npm install` with `config.yaml`"), ["npm install"]);
    assert.deepEqual(commandsIn("#### [`net`](/pkg/net/) and `init`"), []);
    assert.deepEqual(commandsIn("## [`npm install`][install] and [`npm ci`][]"), []);
    assert.deepEqual(commandsIn("## [guide](`npm ci`) `--force`"), ["--force"]);
  });

  it("matches a command as a whole word", () => {
    assert.ok(showsCommand("git push --force origin", "--force"));
    assert.ok(!showsCommand("git push --force-with-lease", "--force"));
    assert.ok(showsCommand("npm   install lodash", "npm install"));
  });

  it("finds a command whose program the code runs under its package name (#621)", () => {
    assert.ok(showsCommand("$ npx chaffjs grade prompt-b.jsonl", "chaff grade"));
    assert.ok(showsCommand("python3 -m venv .venv", "python -m venv"));
    assert.ok(!showsCommand("npx chaffjs grade", "chaff fix"));
    assert.ok(!showsCommand("npx xchaff grade", "chaff grade"));
    assert.ok(!showsCommand("npx foo.chaffjs grade", "chaff grade"));
    assert.ok(!showsCommand("npx chaffjs grader", "chaff grade"));
    assert.ok(!showsCommand("chaffjs", "--grade"));
    const source = doc("## A first run with `chaff grade`", "", "Grade the file.", "", fence("", "$ npx chaffjs grade prompt-b.jsonl --out b.results.jsonl"));
    assert.deepEqual(findingsOf(en, "heading-command-missing", source), []);
  });

  it("reports a heading whose option the section's code spells differently", () => {
    const source = doc("## `--dry-run`", "", "Show the changes.", "", fence("bash", "npx chaffjs fix --dryrun"));
    assert.deepEqual(
      findingsOf(en, "heading-command-missing", source).map((finding) => finding.values["command"]),
      ["--dry-run"],
    );
  });

  it("reads the code up to the next heading of the same level, inline spans included", () => {
    const shown = doc("## `--dry-run`", "", "Add `--dry-run` to any command.", "", "### Example", "", fence("bash", "npx chaffjs"));
    assert.deepEqual(findingsOf(en, "heading-command-missing", shown), []);
    const later = doc("## `--dry-run`", "", "Text with `x`.", "", "## Other", "", fence("bash", "npx chaffjs fix --dry-run"));
    assert.equal(findingsOf(en, "heading-command-missing", later).length, 1);
  });

  it("does not check a section without code", () =>
    assert.deepEqual(findingsOf(en, "heading-command-missing", doc("## `--dry-run`", "", "Shows the changes without making them.")), []));
});

describe("step-statement-mix: a statement among numbered instructions", () => {
  const tokens = (text: string) => en.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

  it("reads a step that opens with an article or a pronoun and a verb as a statement", () => {
    assert.ok(isStatement(tokens("The installer asks for your password.")));
    assert.ok(isStatement(tokens("You click Save to keep the file.")));
    assert.ok(!isStatement(tokens("Open the terminal on your computer.")));
    assert.ok(!isStatement(tokens("Press the Edit button.")));
    assert.ok(!isStatement(tokens("If it fails, run it again.")));
    assert.ok(isStatement(tokens("Docker builds the image.")));
    assert.ok(!isStatement(tokens("Click Save to keep it.")));
    assert.ok(!isStatement(tokens("Guests: the users who are invited.")));
  });

  it("a verb after a noun and a determiner belongs to a clause, not to a subject", () => {
    assert.ok(!isStatement(tokens("Search for an unallocated buffer that is big enough to hold the request.")));
    assert.ok(!isStatement(tokens("Find the file that holds the settings.")));
    assert.ok(isStatement(tokens("The buffer manager returns the buffer.")));
    assert.ok(isStatement(tokens("The list of the users is shown.")));
  });

  it("an adjective not followed by what it describes is an imperative the tagger misread, not a subject", () => {
    assert.ok(!isStatement(tokens("Bake in the oven preheated to 180°C (40 minutes).")));
    assert.ok(!isStatement(tokens("Open the vaultr console and sign in.")));
    assert.ok(isStatement(tokens("Each user gets a key.")));
    assert.ok(isStatement(tokens("Large files took longer to upload.")));
  });

  it("reports a statement among recipe steps but not an imperative read as an adjective", () => {
    const recipe = steps(
      "Chop the onion finely and soak the breadcrumbs in the milk.",
      "Press the mixture into the loaf pan and smooth the top.",
      "Bake in the oven preheated to 180°C (40 minutes).",
      "Leave the meatloaf in the pan to rest.",
    );
    assert.deepEqual(findingsOf(en, "step-statement-mix", recipe), []);
    const planted = steps("Chop the onion finely.", "Press the mixture into the pan.", "The oven heats to 180°C.", "Leave the meatloaf to rest.");
    assert.equal(findingsOf(en, "step-statement-mix", planted).length, 1);
  });

  const steps = (...items: string[]): string => doc(items.map((item, index) => `${String(index + 1)}. ${item}`).join("\n"));

  it("reports the statement in a procedure of instructions", () => {
    const source = steps(
      "Open the terminal on your computer.",
      "Run the installer from the downloads folder.",
      "The installer asks for your password.",
      "Restart the computer.",
    );
    assert.equal(findingsOf(en, "step-statement-mix", source).length, 1);
  });

  it("does not read a bulleted list, a list of terms, or a list of statements", () => {
    const bulleted = doc(["- Open the terminal.", "- Run the installer.", "- The installer asks for a password.", "- Restart the computer."].join("\n"));
    assert.deepEqual(findingsOf(en, "step-statement-mix", bulleted), []);
    const terms = steps("**Members**: People in the team.", "**Guests**: The users who are invited.", "**Anonymous users**: People who join a call.");
    assert.deepEqual(findingsOf(en, "step-statement-mix", terms), []);
    const statements = steps("The tool reads the file.", "It checks each line.", "Then run it again.");
    assert.deepEqual(findingsOf(en, "step-statement-mix", statements), []);
    const mixed = steps(
      "Open the terminal.",
      "If you want, read the notes first.",
      "The installer asks for a password.",
      "On the left bar, choose a folder.",
      "Run the installer.",
    );
    assert.deepEqual(findingsOf(en, "step-statement-mix", mixed), []);
    const tools = steps("Vite starts the dev server.", "TypeScript checks the file.", "React renders the component.", "The CLI prints the result.");
    assert.deepEqual(findingsOf(en, "step-statement-mix", tools), []);
  });
});
