<!-- chaff-sample
rule: elapsed-years-mismatch
genre: business/press-release
file: anniversary.md
-->

# A count of years that does not match its starting year (`elapsed-years-mismatch`)

**Where it helps:** press releases, company profiles, speaker biographies, anniversary letters. Any document reused year after year that says "founded in" and "years since".

## Original

```markdown chaff-before
# Brookside Dental celebrates a milestone

November 2, 2026

Brookside Dental was founded in 2006, and this month marks 10 years since its founding. The practice began with one surgery above the post office and now has four dentists and two hygienists.

To say thank you, the practice will offer free check-ups for children under 12 throughout November.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release anniversary.md

anniversary.md   business/press-release · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    10 years since its founding. The practice began with one surgery above the post

  ⚠  A count of years that does not match its starting year

     From 2006 to 2026 is 20 years, but the text says "10 years"
     A document that says "founded in 2015" and "5 years since its founding", or "born in 1980 (aged 30)", has kept one figure from an older version. It happens when last year's document is copied and only the date is changed. The starting year is taken from the document's own date (a paragraph holding only a date, or "Updated:") and compared with the count of years. When the document names no founding year, the year that "opened" or "opened its doors" gives in the count's own sentence is the starting year ("Brookside Dental opened its doors in 2006, and this month marks 10 years since its founding"). A difference of one year is not pointed out, because of birthdays and of counting the tenth year as 10. A count written as a word ("ten years since its founding") is read as well. An age written beside a labelled date of birth ("Date of birth: March 2, 1969 (age 57)") is compared exactly with the age on a labelled date such as "Examination date" or "Report date", one less before the birthday; "at examination" picks the examination date.

     → Check whether the count or the starting year is right and correct the other. A count that changes every year can be replaced by the starting year alone.

     Relax this rule:  npx chaffjs relax elapsed-years-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Brookside Dental celebrates a milestone

November 2, 2026

Brookside Dental was founded in 2006, and this month marks 20 years since its founding. The practice began with one surgery above the post office and now has four dentists and two hygienists.

To say thank you, the practice will offer free check-ups for children under 12 throughout November.
```

## How it was fixed

Founded in 2006, and dated November 2026: that is 20 years, not 10.
The release was built from the one sent for the tenth anniversary, and the date and the headline changed while the count stayed.
It is the one figure every reader will notice, and a local paper that prints it will print the wrong anniversary.

The fix writes the count that the two dates give.
For text that is reused every year, another way is to keep only the year ("founded in 2006"), so there is no count to go stale.

## Settings

A count that does not match is a warning at the default level; `relaxed` makes it a note:

```yaml chaff-settings
rules:
  elapsed-years-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The year to count to is the document's own date: a paragraph holding only a date, or an "Updated:" line.
A document without one is not checked.
A difference of one year is not reported, because of birthdays and of counting the tenth year as 10.
An age beside a labelled date of birth is compared with a labelled date such as "Report date".
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain elapsed-years-mismatch --genre business/press-release

  A count of years that does not match its starting year   (elapsed-years-mismatch)

  A document that says "founded in 2015" and "5 years since its founding", or "born in 1980 (aged 30)", has kept one figure from an older version. It happens when last year's document is copied and only the date is changed. The starting year is taken from the document's own date (a paragraph holding only a date, or "Updated:") and compared with the count of years. When the document names no founding year, the year that "opened" or "opened its doors" gives in the count's own sentence is the starting year ("Brookside Dental opened its doors in 2006, and this month marks 10 years since its founding"). A difference of one year is not pointed out, because of birthdays and of counting the tenth year as 10. A count written as a word ("ten years since its founding") is read as well. An age written beside a labelled date of birth ("Date of birth: March 2, 1969 (age 57)") is compared exactly with the age on a labelled date such as "Examination date" or "Report date", one less before the birthday; "at examination" picks the examination date.

  How to fix: Check whether the count or the starting year is right and correct the other. A count that changes every year can be replaced by the starting year alone.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax elapsed-years-mismatch --why "reason"
```

[All samples](README.md)
