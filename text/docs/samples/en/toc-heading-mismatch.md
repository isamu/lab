<!-- chaff-sample
rule: toc-heading-mismatch
genre: docs/manual
file: handbook.md
-->

# A table-of-contents entry with no heading (`toc-heading-mismatch`)

**Where it helps:** handbooks, manuals, long reports. Any document with a table of contents written by hand.

## Original

```markdown chaff-before
# Staff handbook

## Contents

- 1 Working hours
- 2 Holidays
- 3 Expenses

## 1 Working hours

The office is open from 8:00 to 18:00.

## 2 Annual leave

Every employee has 25 days of paid leave a year.

## 3 Expenses

Claims are paid with the next salary.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual handbook.md

handbook.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    - 1 Working hours - 2 Holidays - 3 Expenses ## 1

  ⚠  A table-of-contents entry with no heading

     No heading matches the contents entry "2 Holidays"
     When the table of contents lists "3.2 Costs" and the text has no such heading, the reader cannot get there from the contents. It happens when a heading is renamed or a section removed and the contents are left as they were. Matching the entries against the headings is mechanical.

     → Update the entry to match the heading, or remove the entry for a section that is gone.

     Relax this rule:  npx chaffjs relax toc-heading-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Staff handbook

## Contents

- 1 Working hours
- 2 Annual leave
- 3 Expenses

## 1 Working hours

The office is open from 8:00 to 18:00.

## 2 Annual leave

Every employee has 25 days of paid leave a year.

## 3 Expenses

Claims are paid with the next salary.
```

## How it was fixed

The contents list "2 Holidays", but the section is now called "2 Annual leave".
A reader looking for holidays in the contents finds the entry, and then a heading that does not match it.
The heading was renamed and the contents were left as they were.

The fix updates the entry to the heading as it is written now.
chaff compares entries with headings ignoring spaces, punctuation, case, and a leading number or page number.
When more than half of the entries match no heading, the contents are taken to follow another outline and nothing is reported.

## Settings

An entry that matches no heading is a warning at the default level and a note at `relaxed`.

If your contents use short names for the sections on purpose, relax it:

```yaml chaff-settings
rules:
  toc-heading-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain toc-heading-mismatch --genre docs/manual

  A table-of-contents entry with no heading   (toc-heading-mismatch)

  When the table of contents lists "3.2 Costs" and the text has no such heading, the reader cannot get there from the contents. It happens when a heading is renamed or a section removed and the contents are left as they were. Matching the entries against the headings is mechanical.

  How to fix: Update the entry to match the heading, or remove the entry for a section that is gone.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax toc-heading-mismatch --why "reason"
```

[All samples](README.md)
