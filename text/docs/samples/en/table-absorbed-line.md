<!-- chaff-sample
rule: table-absorbed-line
genre: business/report
file: event-budget.md
-->

# Line swallowed by a table (`table-absorbed-line`)

**Where it helps:** reports, budgets, quotes. Any Markdown table with a note or a total written just below it.

## Original

```markdown chaff-before
# Team offsite: budget

| Item | Cost |
| --- | --- |
| Venue | $1,200 |
| Lunch | $450 |
| Transport | $300 |
All amounts include tax; the venue needs a deposit by May 2.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report event-budget.md

event-budget.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    All amounts include tax; the venue needs a deposit by May 2.

  ⚠  Line swallowed by a table

     This line is read as a row of the table above and is shown in its first column
     A Markdown table (GFM) runs until a blank line. A sentence written right under a table with no blank line between is read as one more row and shown in the table's first cell. The note or the total written after the table turns into a row inside it. The line has no "|" at all, so the writer meant it to stand outside the table.

     → Put a blank line between the table and this line. If it is meant to be a row, separate its cells with "|".

     Relax this rule:  npx chaffjs relax table-absorbed-line


─── line 8 ───────────────────────────────────────────────────

  ⚠  Blank table cell

     The "Cost" column is blank in this row only
     Every other row fills this column, and one row leaves it blank. The reader cannot tell whether it was forgotten, does not apply, or is not decided yet. In an owner or due-date column, that row's task is left to no one.

     → Fill it in. If it does not apply, write "none" or "—"; if it is not decided, write "TBD" and when it will be.

     Relax this rule:  npx chaffjs relax empty-table-cell


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Team offsite: budget

| Item | Cost |
| --- | --- |
| Venue | $1,200 |
| Lunch | $450 |
| Transport | $300 |

All amounts include tax; the venue needs a deposit by May 2.
```

## How it was fixed

The note about tax and the deposit was written on the line right under the table.
A Markdown table runs until a blank line, so the note becomes a fourth row: it is squeezed into the "Item" column, and the deadline is easy to miss among the costs.

The fix leaves a blank line between the table and the note, so the note is its own paragraph again.

## Settings

A line swallowed by a table is a warning at the default level; `strict` makes it an error and `relaxed` a note.

```yaml chaff-settings
rules:
  table-absorbed-line: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain table-absorbed-line --genre business/report

  Line swallowed by a table   (table-absorbed-line)

  A Markdown table (GFM) runs until a blank line. A sentence written right under a table with no blank line between is read as one more row and shown in the table's first cell. The note or the total written after the table turns into a row inside it. The line has no "|" at all, so the writer meant it to stand outside the table.

  How to fix: Put a blank line between the table and this line. If it is meant to be a row, separate its cells with "|".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax table-absorbed-line --why "reason"
```

[All samples](README.md)
