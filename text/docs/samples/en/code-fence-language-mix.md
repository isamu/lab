<!-- chaff-sample
rule: code-fence-language-mix
genre: technical/readme
file: README.md
-->

# Code blocks with and without a language (`code-fence-language-mix`)

**Where it helps:** READMEs, setup guides, technical blog posts. Any page with several code blocks.

## Original

````markdown chaff-before
# tidy-csv

Removes empty rows and trailing spaces from CSV files.

## Install

```bash
yarn add tidy-csv
```

## Use

```bash
yarn tidy-csv orders.csv
```

## Settings

Put a `tidy-csv.json` file next to your CSV files:

```
{ "keepEmptyRows": false, "trim": true }
```

Or set the same options in `package.json`:

```json
{ "tidy-csv": { "keepEmptyRows": false, "trim": true } }
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · English   genre from --genre

─── line 21 ──────────────────────────────────────────────────

    ```

  ·  Code blocks with and without a language

     This code block names no language, unlike the others (3 blocks name one)
     A language on a code block (```bash, ```json) gives it highlighting on the reader's screen and says at a glance what it is. When most blocks name their language and a few do not, those few show plain and look forgotten. chaff does not decide which way to go; it points at the fewer (markdownlint's MD040 asks for a language on every block).

     → Add the language after the opening ```. For output or plain text, write "text".

     Relax this rule:  npx chaffjs relax code-fence-language-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# tidy-csv

Removes empty rows and trailing spaces from CSV files.

## Install

```bash
yarn add tidy-csv
```

## Use

```bash
yarn tidy-csv orders.csv
```

## Settings

Put a `tidy-csv.json` file next to your CSV files:

```json
{ "keepEmptyRows": false, "trim": true }
```

Or set the same options in `package.json`:

```json
{ "tidy-csv": { "keepEmptyRows": false, "trim": true } }
```
````

## How it was fixed

Three code blocks name their language, so the reader's screen colours them and says at a glance what they are.
The settings file does not, so it shows as plain grey text, and it looks forgotten next to the `package.json` block below it.

The fix adds `json` after the opening backticks.
For output or plain text, write `text`, so the block still names what it is.

## Settings

At `normal`, it is reported when two blocks or fewer lack a language and they are fewer than those with one; `strict` allows three, `relaxed` one.
Above that, leaving the language out is read as a choice.
Indented code blocks and a block introduced as output are not read.

To stop checking:

```yaml chaff-settings
rules:
  code-fence-language-mix: off
```

It is off for legal, academic, literature and speech texts.

```text chaff-explain
$ npx chaffjs explain code-fence-language-mix --genre technical/readme

  Code blocks with and without a language   (code-fence-language-mix)

  A language on a code block (```bash, ```json) gives it highlighting on the reader's screen and says at a glance what it is. When most blocks name their language and a few do not, those few show plain and look forgotten. chaff does not decide which way to go; it points at the fewer (markdownlint's MD040 asks for a language on every block).

  How to fix: Add the language after the opening ```. For output or plain text, write "text".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when 3 or fewer blocks lack a language and they are fewer than those with one
  → normal   reported when 2 or fewer blocks lack a language and they are fewer than those with one
    relaxed  reported when 1 or fewer blocks lack a language and they are fewer than those with one
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax code-fence-language-mix --why "reason"
```

[All samples](README.md)
