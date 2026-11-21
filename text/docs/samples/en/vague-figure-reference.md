<!-- chaff-sample
rule: vague-figure-reference
genre: business/report
file: energy-report.md
-->

# A figure, table or clause pointed at by where it is (`vague-figure-reference`)

**Where it helps:** reports, papers, manuals with numbered figures and tables.

## Original

```markdown chaff-before
# Office energy use, 2026

Electricity use fell by 18% after the new lights were fitted in March, as the figure below shows.

Figure 1: Monthly electricity use, January to October 2026

Heating stayed at the same level as last year.

Figure 2: Monthly gas use, January to October 2026
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report energy-report.md

energy-report.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    the figure below shows.

  ⚠  A figure, table or clause pointed at by where it is

     Name it by its number instead of "the figure below" (this document numbers its Figures)
     "The figure above" makes the reader search for the figure. When a figure is added or moved, what it points at changes without a word. Printing, page breaks and the width of the screen change what is above and below as well. JIS Z 8301:2019, 10.6, rules out pointers such as "the figure above". A document that numbers its figures and tables can name them ("Figure 3"), and one that numbers its clauses can name a clause ("Clause 4"). A kind that the document never numbers is not checked.

     → Write the number of the figure, table or clause. "As the figure above shows" becomes "as Figure 3 shows"; "under the clause below" becomes "under Clause 5".

     Relax this rule:  npx chaffjs relax vague-figure-reference


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office energy use, 2026

Electricity use fell by 18% after the new lights were fitted in March, as Figure 1 shows.

Figure 1: Monthly electricity use, January to October 2026

Heating stayed at the same level as last year.

Figure 2: Monthly gas use, January to October 2026
```

## How it was fixed

The report numbers its figures, but the text says "the figure below".
Below that sentence there are two figures, and when the report is laid out on slides or printed, the electricity chart may land on the next page.
A reader looks at the gas figure and wonders where the 18% fall is.

The fix names the figure by its number.
chaff checks only kinds the document numbers: a document with no "Figure 1" caption has no number to use, and is not reported.

## Settings

A figure named by its place is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents are only read on one screen, where "below" is stable, relax it:

```yaml chaff-settings
rules:
  vague-figure-reference: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature.

```text chaff-explain
$ npx chaffjs explain vague-figure-reference --genre business/report

  A figure, table or clause pointed at by where it is   (vague-figure-reference)

  "The figure above" makes the reader search for the figure. When a figure is added or moved, what it points at changes without a word. Printing, page breaks and the width of the screen change what is above and below as well. JIS Z 8301:2019, 10.6, rules out pointers such as "the figure above". A document that numbers its figures and tables can name them ("Figure 3"), and one that numbers its clauses can name a clause ("Clause 4"). A kind that the document never numbers is not checked.

  How to fix: Write the number of the figure, table or clause. "As the figure above shows" becomes "as Figure 3 shows"; "under the clause below" becomes "under Clause 5".

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax vague-figure-reference --why "reason"
```

[All samples](README.md)
