<!-- chaff-sample
rule: unclosed-code-fence
genre: technical/readme
file: README.md
-->

# Unclosed code fence (`unclosed-code-fence`)

**Where it helps:** READMEs, technical guides, help pages with command examples.

## Original

````markdown chaff-before
# Invoice exporter

Exports last month's invoices to a CSV file.

## Install

```sh
yarn add invoice-exporter

## Usage

Run `invoice-export --month 2026-10` to write `invoices-2026-10.csv` in the current folder.
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    ```sh

  ⚠  Unclosed code fence

     The code block opened with "```sh" is never closed
     A code block opened with "```" and never closed runs to the end of the document (or of the list item it is in), so Markdown shows everything after it as code. The headings and text that follow turn into one block of monospaced text, and the document looks broken.

     → Add a line after the code with the same character, at least as many ("```").

     Relax this rule:  npx chaffjs relax unclosed-code-fence


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# Invoice exporter

Exports last month's invoices to a CSV file.

## Install

```sh
yarn add invoice-exporter
```

## Usage

Run `invoice-export --month 2026-10` to write `invoices-2026-10.csv` in the current folder.
````

## How it was fixed

The install command opens a code block with ``` and never closes it.
Everything after it, the "Usage" heading and its sentence, is shown as one block of code. A developer opening the README sees an install command followed by what looks like a broken page.

The fix closes the block with a line holding the same fence.
A block opened inside a list item runs to the end of that item, and is reported the same way.

## Settings

An unclosed code block is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents are not shown as Markdown, relax it:

```yaml chaff-settings
rules:
  unclosed-code-fence: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain unclosed-code-fence --genre technical/readme

  Unclosed code fence   (unclosed-code-fence)

  A code block opened with "```" and never closed runs to the end of the document (or of the list item it is in), so Markdown shows everything after it as code. The headings and text that follow turn into one block of monospaced text, and the document looks broken.

  How to fix: Add a line after the code with the same character, at least as many ("```").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unclosed-code-fence --why "reason"
```

[All samples](README.md)
