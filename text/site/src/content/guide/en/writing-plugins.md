# Writing a plugin

How to write a chaff rule as a Node function, and how to pack rules into a package to share.
A rule that words or a regular expression can say needs no code; see [Adding a rule](./adding-rules) first.
Write code only for what those cannot say, such as counting or comparing.

## Two forms

| Form | When it fits | Where it goes |
| --- | --- | --- |
| A function rule | One team adds one rule | `type: module` under `custom_rules` in `chaff.yaml` |
| A plugin | Rules, word lists and styles shared by several teams | a package `chaff-plugin-<name>`, or a file of your own |

Either way, a rule is the same function: it takes the document and returns a list of findings.
Types and helpers come from `chaffjs/api`.

```js
import { API_VERSION, defineRule, definePlugin } from "chaffjs/api";
```

## What the function is given

The function is `(doc, options) => findings`. `doc` holds the following.
Every position is a place in `doc.source`, counted in UTF-16 units.

| Name | What it holds |
| --- | --- |
| `source` `path` `language` | the whole text, the file, and the document's language (`ja` or `en`) |
| `sentences` | the sentences, each with its `span` (start and end) and `text` |
| `sentences[].tokens` | the words, with `pos` (a UPOS tag such as `NOUN` or `VERB`) and `lemma`; only with `requires: [pos]` |
| `paragraphs` `sections` | paragraphs, and sections split at headings; a section has a `depth` and a `heading` |
| `lists` `listItems` | bulleted and numbered lists, and their items |
| `links` `markup` | where the links are, and the markup (headings, images, link targets) |
| `lexicons` | word lists, by name |

`options.lexicon` is the rule's `word_list`, in the document's language.
`doc` is frozen and cannot be changed, so one rule cannot change what the next one reads.

## What it returns

A finding is `{ start, end, values }`; `end` and `values` may be left out.
chaff counts the line and column, quotes the sentence there, and puts the text from `start` to `end` into `{matched}` in
the rule's `message`. Each entry in `values` fills `{name}` in the message too.
When nothing is found, return an empty list.

## Step by step: a plugin

The example flags a sentence that leaves a date as TBD. The same plugin is in
[examples/chaff-plugin-example](https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-example).

First, make a folder and a `package.json`. Name the package `chaff-plugin-<name>`.

```json
{
  "name": "chaff-plugin-example",
  "type": "module",
  "main": "index.mjs",
  "peerDependencies": { "chaffjs": ">=0.18.0" }
}
```

Second, write the rule's function. It reads only the document, and gives the same findings for the same document.

```js
// rules/no-tbd-dates.mjs
export const noTbdDates = (doc) =>
  doc.sentences.flatMap((sentence) =>
    [...sentence.text.matchAll(/TBD|未定/gu)].map((match) => ({
      start: sentence.span.start + match.index,
      end: sentence.span.start + match.index + match[0].length,
    })),
  );
```

Third, `export default` a `definePlugin` from `index.mjs`.
Each rule has a name, a reason, a fix and an example, as in `custom_rules`.
`name` comes from the package's name: `chaff-plugin-example` is `example`.

```js
// index.mjs
import { definePlugin } from "chaffjs/api";
import { noTbdDates } from "./rules/no-tbd-dates.mjs";

export default definePlugin({
  name: "example",
  rules: [
    {
      id: "no-tbd-dates",
      level: "warning",
      name: { ja: "未定のままの日付", en: "A date left undecided" },
      why: { ja: "読み手は日付をもとに予定を立てます", en: "A reader plans around a date" },
      how_to_fix: { ja: "日付か、決める人と期限を書きます", en: "Write the date, or who decides it" },
      example: { before: { ja: "公開日は未定です。", en: "It is TBD." }, after: { ja: "公開日は 10 月 1 日です。", en: "It is on 1 October." } },
      detect: noTbdDates,
    },
  ],
});
```

Fourth, list it in the project's `chaff.yaml`. Its rules are named with the plugin's name in front.

```yaml
plugins: [chaff-plugin-example]
rules:
  example/no-tbd-dates: strict
```

Findings, `explain`, `rules --json`, `relax`, `stet`, the baseline and SARIF treat it like chaff's own rules.
`<!-- stet: example/no-tbd-dates -->` silences one place.

## Word lists and styles

A word list goes under `lexicons`, by language, and a rule names it with `word_list`.
The function gets the list for the document's language as `options.lexicon`.
On a document in a language the list does not cover, the rule is listed as not run, with the reason.

```js
lexicons: { weasel: { en: ["some say", "arguably"], ja: ["と言われている", "一般的に"] } },
```

A style sets the levels of several rules at once, written as chaff's own styles (`styles/*.yaml`) are.
A project chooses it with `style: example/careful`.

```js
styles: [{ id: "careful", name: "Careful with dates", summary: "An undecided date is an error", source: { title: "Our style guide", url: "https://example.com/style" }, rules: { "example/no-tbd-dates": "strict" } }],
```

## Testing a plugin

A rule's function only takes a document, so it can be tested without running chaff.
Build the part of the document the function reads, call it, and compare what it returns.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { noTbdDates } from "../rules/no-tbd-dates.mjs";

test("flags an undecided date", () => {
  const text = "The launch is TBD.";
  const doc = { source: text, sentences: [{ span: { start: 0, end: text.length }, text }] };
  assert.deepEqual(noTbdDates(doc), [{ start: 14, end: 17 }]);
});
```

To check it through chaff, run `npx chaffjs sample.md` in a folder with sample documents.
Try samples that should be flagged and samples that should not.

## When something is broken

What cannot be loaded stops the run before any document is read (exit code 1). Each message names the rule or plugin
and the file.

```
chaff: chaff.yaml: plugins chaff-plugin-missing: not found. For a package, run yarn add chaff-plugin-missing in the folder chaff.yaml is in
```

A missing file, a file that cannot be loaded, another API version and a rule with a field missing each stop the run
this way. So does a default export that is neither a function nor a plugin. A rule that silently does not run looks
like a clean document.

When a function throws while reading a document, or returns findings of the wrong shape, only that rule stops.
Every other rule runs to the end, and the stopped rule is listed as not run, with the reason.

```
      team-broken (the detector in ./chaff-rules/broken.mjs threw an error (Cannot read properties of undefined (reading 'length')))
```

## Versions

The shape of `chaffjs/api` is the plugin API's version, `API_VERSION`. It is 1.
`definePlugin` and `defineRule` stamp the version they were made with.
chaff refuses a plugin written for another version.

```
chaff: chaff.yaml: custom_rules team-broken: ./chaff-rules/broken.mjs was written for plugin API 2; this chaff has plugin API 1
```

A rule that default-exports a bare function carries no version and is read against the running chaff's.
To pin it, wrap it in `defineRule({ detect })`.

## Security

Loading a plugin or a function rule runs its code, every time chaff runs where that `chaff.yaml` names it.
Install only plugins you trust.
A file outside the folder `chaff.yaml` is in is read only when written as an absolute path.
That way a `chaff.yaml` copied from elsewhere cannot reach for code with `../../`.

## Rules for rules

- **The same document gives the same findings.** Read no clock, randomness, files or network. chaff cannot check
  this; the author keeps to it.
- **Never change the document.** Fixing it is the writer's job.
- **Always return.** chaff cannot stop a function that runs forever.
- **Leave meaning to `chaff test`.** A rule decides only what a machine can.

## Publishing

Copy [examples/chaff-plugin-example](https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-example) to start.
Name the package `chaff-plugin-<name>` (or `@scope/chaff-plugin-<name>`) and set `definePlugin`'s `name` to match.
Keep `chaffjs` in `peerDependencies`, so the plugin uses the chaff the project runs.
Point `main`, or `exports["."]`, at the entry file; an `exports` with only an `import` condition is not found.
Then run `npm publish`.
