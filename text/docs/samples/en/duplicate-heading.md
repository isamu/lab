<!-- chaff-sample
rule: duplicate-heading
genre: docs/manual
file: printer-guide.md
-->

# Duplicate sibling heading (`duplicate-heading`)

**Where it helps:** manuals, help pages, handbooks. Any document that grows by copying a section and editing it.

## Original

```markdown chaff-before
# Office printer guide

## Printing from your laptop

Choose "Floor 3 Printer" in the print dialog.

## Scanning a document

Place the page face down on the glass and press Scan.

## Printing from your laptop

Collect your pages at the printer by tapping your badge on the reader.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual printer-guide.md

printer-guide.md   docs/manual · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    ## Printing from your laptop

  ⚠  Duplicate sibling heading

     The heading "Printing from your laptop" repeats the one on line 3 under the same parent
     Two headings with the same words under the same parent cannot be told apart in a table of contents, and an in-page link reaches only one of them. It happens when a section is copied and its heading is not changed, or when the same topic is written in two places. Under different parents the same words are fine (a changelog's "Added" and "Fixed" under each version, a "Summary" in each chapter). Case, full-width and half-width forms, and the number of spaces are ignored when comparing.

     → Merge the two sections, or give each a heading that says how they differ.

     Relax this rule:  npx chaffjs relax duplicate-heading


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office printer guide

## Printing from your laptop

Choose "Floor 3 Printer" in the print dialog.

## Scanning a document

Place the page face down on the glass and press Scan.

## Collecting your pages

Collect your pages at the printer by tapping your badge on the reader.
```

## How it was fixed

Two sections are called "Printing from your laptop".
In a table of contents they look the same, and a link to the heading reaches only the first.
Someone looking for how to collect their pages opens the first one and finds only the print dialog.

The second section was copied from the first and its heading was not changed.
The fix gives it a heading that says what it covers.
The same heading under different parents is fine, such as a "Before you start" in each chapter.

## Settings

A repeated sibling heading is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents repeat a heading on purpose (a log with the same heading for every entry), relax it:

```yaml chaff-settings
rules:
  duplicate-heading: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature, where two poems may share a title.

```text chaff-explain
$ npx chaffjs explain duplicate-heading --genre docs/manual

  Duplicate sibling heading   (duplicate-heading)

  Two headings with the same words under the same parent cannot be told apart in a table of contents, and an in-page link reaches only one of them. It happens when a section is copied and its heading is not changed, or when the same topic is written in two places. Under different parents the same words are fine (a changelog's "Added" and "Fixed" under each version, a "Summary" in each chapter). Case, full-width and half-width forms, and the number of spaces are ignored when comparing.

  How to fix: Merge the two sections, or give each a heading that says how they differ.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax duplicate-heading --why "reason"
```

[All samples](README.md)
