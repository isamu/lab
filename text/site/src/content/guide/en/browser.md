# Checking in a browser

chaff also runs inside a web page, with the same rules and messages as the command line.
The text is checked in the page and is sent nowhere.
This page covers the playground on this site, and `chaffjs/browser`, the entry point for putting chaff in your own page.

## Trying it on this site

The [playground](../../playground/) checks a text without installing anything.

1. Pick a sample, or paste your own text.
2. Choose the language and the genre, or leave them to chaff. With no genre, the text is read as a tech blog, as the command line reads a file with no settings.
3. Press Check.

It shows the findings by line, each with its rule, why it matters and how to fix it.
It also shows the quick AI-likeness score and the rules that did not run, each with its reason.

The page loads chaff's code and rules, and a dictionary the first time it checks Japanese. The dictionary is large, so the first Japanese check takes a moment.

What the playground does not do:

- It has no `chaff.yaml`, so the team's words, spellings and levels are not applied. Check those on your own machine.
- It checks one text, so the rules that compare files (the `cross-doc-` rules) do not run.
- It does not run `chaff test`, the checks that read meaning.

The same text gives the same findings on your machine: save it as a file and run `npx chaffjs --genre <genre> <file>`.

## In your own page: `chaffjs/browser`

`chaffjs/browser` checks a text in a web page, with no file system and no server. The playground is built on it.

```ts
import { check, setupBrowser } from "chaffjs/browser";

setupBrowser({
  files: async (packageName) => loadFilesOf(packageName), // the files of chaffjs, @chaffjs/lang-ja and @chaffjs/lang-en (path → text)
  kuromojiDictionaryUrl: "https://example.com/kuromoji/", // where the kuromoji dictionary is served (an absolute URL ending in /)
});

const result = await check(text, { genre: "business/report" });
// result.findings, result.notRun (the rules that did not run, and why), result.aiScore
```

`setupBrowser()` is called once, before the first `check()`.
`files` gives each package's rules, genres and word lists, which the command line reads from disk.
A page fetches them only when a check needs them.

`check(text, options)` takes these options. Each is the same as on the command line.

| Option | What it is |
| --- | --- |
| `language` | `ja` or `en`. Guessed from the text when left out |
| `genre` | A genre, as `--genre` |
| `config` | The contents of a `chaff.yaml`, already parsed. Without it, chaff's defaults apply |
| `path` | The document's name. Rules for Markdown run only on a `.md` name; `document.md` when left out |
| `experimental` | Run the experimental rules too, as `--experimental` |

The settings in `config` that read files (`plugins`, `include`, `by_path`) cannot work in a page.
They are not applied, and each is listed in `notRun` with that reason.

The result holds the language and genre used, `findings`, `notRun` and `aiScore`.
Each finding carries its rule, level, line and column, the message, the rule's name, why it matters, how to fix it, and the passage it is about.

It needs a bundler that reads package.json's `browser` field and `import.meta.glob`, such as Vite.
With `vite dev`, put `chaffjs` in `optimizeDeps.exclude`.
How the playground serves the files and the dictionary is in its source: [`site/src/lib/playground.ts`](https://github.com/isamu/lab/blob/main/text/site/src/lib/playground.ts) and [`scripts/browser-files.ts`](https://github.com/isamu/lab/blob/main/text/scripts/browser-files.ts).

## What to read next

- Running chaff on your own files, with no setup, is in [Getting started](./getting-started).
- Fitting the checks to your team with `chaff.yaml` is in [Configuration](./configuration).
- Checking model outputs in process, with `grade()`, is in [Using chaff for AI evals](./ai-evals).
- Every rule, with an example and its real output, is in the [Reference](./reference).
