<!-- chaff-sample
rule: empty-table-cell
genre: business/meeting-notes
file: minutes.md
-->

# Blank table cell (`empty-table-cell`)

**Where it helps:** minutes with an action table, project plans, rotas. Any table with an owner or a due-date column.

## Original

```markdown chaff-before
# Website relaunch: weekly meeting

## Actions

| Action | Owner | Due |
| --- | --- | --- |
| Send the new menu labels to the designer | Priya Shah | November 25, 2026 |
| Check every product page on a phone | | November 27, 2026 |
| Book the photographer for the team page | Tom Reed | December 2, 2026 |
| Write the redirect list for the old pages | Ana Silva | December 4, 2026 |
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes minutes.md

minutes.md   business/meeting-notes · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    | | November 27, 2026 |

  ⚠  Blank table cell

     The "Owner" column is blank in this row only
     Every other row fills this column, and one row leaves it blank. The reader cannot tell whether it was forgotten, does not apply, or is not decided yet. In an owner or due-date column, that row's task is left to no one.

     → Fill it in. If it does not apply, write "none" or "—"; if it is not decided, write "TBD" and when it will be.

     Relax this rule:  npx chaffjs relax empty-table-cell


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Website relaunch: weekly meeting

## Actions

| Action | Owner | Due |
| --- | --- | --- |
| Send the new menu labels to the designer | Priya Shah | November 25, 2026 |
| Check every product page on a phone | Ana Silva | November 27, 2026 |
| Book the photographer for the team page | Tom Reed | December 2, 2026 |
| Write the redirect list for the old pages | Ana Silva | December 4, 2026 |
```

## How it was fixed

Every action in the table has an owner except the check on phones.
At the next meeting nobody will have done it, and nobody will feel they should have: the minutes gave it to no one.
A blank cell cannot say whether the owner was forgotten, does not apply, or is still to be decided.

The fix writes the name agreed at the meeting.
If nobody was chosen, write "TBD" and when it will be decided; if the column does not apply to a row, write "none" or "—".
The first column is not checked, since a blank there often means "same as above".

## Settings

An empty cell is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your tables leave cells empty on purpose, relax it:

```yaml chaff-settings
rules:
  empty-table-cell: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A column with two or more blanks, and a table with fewer than three rows, are not reported.

```text chaff-explain
$ npx chaffjs explain empty-table-cell --genre business/meeting-notes

  Blank table cell   (empty-table-cell)

  Every other row fills this column, and one row leaves it blank. The reader cannot tell whether it was forgotten, does not apply, or is not decided yet. In an owner or due-date column, that row's task is left to no one.

  How to fix: Fill it in. If it does not apply, write "none" or "—"; if it is not decided, write "TBD" and when it will be.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax empty-table-cell --why "reason"
```

[All samples](README.md)
