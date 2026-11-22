<!-- chaff-sample
rule: dangling-figure-reference
genre: business/report
file: q3-support-report.md
-->

# Reference to a missing figure or table (`dangling-figure-reference`)

**Where it helps:** reports, manuals, papers, proposals. Any document whose text points the reader to a numbered figure or table.

## Original

```markdown chaff-before
# Customer support: third-quarter report

Tickets rose in September after the price change (Table 1), while the time to a first answer stayed under four hours.
Most of the new tickets were about invoices, and they were answered faster than other kinds (Table 3).

Table 1: Tickets by month

| Month | Tickets |
| --- | --- |
| July | 1,240 |
| August | 1,310 |
| September | 1,820 |

Table 2: First answer time by kind of ticket

| Kind | Median time |
| --- | --- |
| Invoices | 2 hours |
| Accounts | 3 hours |
| Technical | 5 hours |
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report q3-support-report.md

q3-support-report.md   business/report · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    Table 3).

  ⚠  Reference to a missing figure or table

     Table 3 is referred to, but the document has no Table 3
     When the text says "see Figure 3" and there is no Figure 3, the reader searches for it and then has to work out whether the figure was dropped or the numbers shifted. It happens when a figure or a table is removed or reordered and the text is not updated. A number written at the start of a line (a caption such as "Figure 1: Sales by month", or a heading such as "## Appendix A") is where that figure is, and a number in the text that is none of them is pointed out. A kind (figures, tables, appendices) that the document never labels at the start of a line is not checked, because its figures may be in another file.

     → Check whether the numbers shifted. Correct the number in the text, or add the missing figure or table.

     Relax this rule:  npx chaffjs relax dangling-figure-reference


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Customer support: third-quarter report

Tickets rose in September after the price change (Table 1), while the time to a first answer stayed under four hours.
Most of the new tickets were about invoices, and they were answered faster than other kinds (Table 2).

Table 1: Tickets by month

| Month | Tickets |
| --- | --- |
| July | 1,240 |
| August | 1,310 |
| September | 1,820 |

Table 2: First answer time by kind of ticket

| Kind | Median time |
| --- | --- |
| Invoices | 2 hours |
| Accounts | 3 hours |
| Technical | 5 hours |
```

## How it was fixed

The text points to Table 3, and the report has two tables.
A table on staffing between the two was cut in review, and the tables after it were renumbered; the sentence kept the old number.
A manager reading the report looks for Table 3, finds none, and has to guess whether the evidence for the claim was dropped.

The fix points to Table 2, the table that shows answer times by kind.
If the missing table was meant to stay, add it back instead.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  dangling-figure-reference: relaxed
```

A number written at the start of a line (a caption such as "Table 1: Tickets by month", or a heading such as "## Appendix A") is where that figure is.
A kind the document never labels at the start of a line is not checked, because its figures may be in another file, and neither is a figure of another document ("Figure 5 of the 2024 report").

```text chaff-explain
$ npx chaffjs explain dangling-figure-reference --genre business/report

  Reference to a missing figure or table   (dangling-figure-reference)

  When the text says "see Figure 3" and there is no Figure 3, the reader searches for it and then has to work out whether the figure was dropped or the numbers shifted. It happens when a figure or a table is removed or reordered and the text is not updated. A number written at the start of a line (a caption such as "Figure 1: Sales by month", or a heading such as "## Appendix A") is where that figure is, and a number in the text that is none of them is pointed out. A kind (figures, tables, appendices) that the document never labels at the start of a line is not checked, because its figures may be in another file.

  How to fix: Check whether the numbers shifted. Correct the number in the text, or add the missing figure or table.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax dangling-figure-reference --why "reason"
```

[All samples](README.md)
