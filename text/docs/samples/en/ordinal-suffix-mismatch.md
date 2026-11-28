<!-- chaff-sample
rule: ordinal-suffix-mismatch
genre: business/press-release
file: festival.md
-->

# An ordinal with the wrong ending (`ordinal-suffix-mismatch`)

**Where it helps:** invitations, announcements, schedules, minutes. Anywhere a date or an anniversary is written as a number.

## Original

```markdown chaff-before
# Riverside Book Festival returns in September

The Riverside Book Festival celebrates its 23th year this autumn.
The festival runs from Friday 12 September to Sunday 14 September in the old market hall.

Tickets go on sale on the 1th of July, and festival friends can book a week earlier.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release festival.md

festival.md   business/press-release · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    The Riverside Book Festival celebrates its 23th year this autumn.

  ⚠  An ordinal with the wrong ending

     "23th" is written "23rd"
     An English ordinal's ending is fixed by how the number ends (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st). "3th", "22th" or "11st" is a slip, or a number changed with its old ending left on, and the reader starts to doubt the number. The ending follows from the number, so a machine can tell.

     → Check that the number is right, then give it the ending that goes with it.

     Relax this rule:  npx chaffjs relax ordinal-suffix-mismatch


─── line 6 ───────────────────────────────────────────────────

    Tickets go on sale on the 1th of July, and festival friends can book a week earlier.

  ⚠  An ordinal with the wrong ending

     "1th" is written "1st"
     An English ordinal's ending is fixed by how the number ends (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st). "3th", "22th" or "11st" is a slip, or a number changed with its old ending left on, and the reader starts to doubt the number. The ending follows from the number, so a machine can tell.

     → Check that the number is right, then give it the ending that goes with it.

     Relax this rule:  npx chaffjs relax ordinal-suffix-mismatch


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Riverside Book Festival returns in September

The Riverside Book Festival celebrates its 23rd year this autumn.
The festival runs from Friday 12 September to Sunday 14 September in the old market hall.

Tickets go on sale on the 1st of July, and festival friends can book a week earlier.
```

## How it was fixed

"23th" and "1th" usually mean a number was changed and its old ending left on: last year's notice said "22nd", or the sale date was once the 4th.
A reader who notices the slip starts to wonder whether the number itself is right, and on a ticket date that matters.

The fix checks each number and gives it the ending that goes with it: 23rd, 1st.
Because the ending follows from the number, a machine can catch this every time.

## Settings

The rule is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  ordinal-suffix-mismatch: relaxed
```

It runs in every genre.
Parts of an identifier (v1th, 0x2nd), the "2d" and "3d" of legal citations, and code are not read.

```text chaff-explain
$ npx chaffjs explain ordinal-suffix-mismatch --genre business/press-release

  An ordinal with the wrong ending   (ordinal-suffix-mismatch)

  An English ordinal's ending is fixed by how the number ends (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st). "3th", "22th" or "11st" is a slip, or a number changed with its old ending left on, and the reader starts to doubt the number. The ending follows from the number, so a machine can tell.

  How to fix: Check that the number is right, then give it the ending that goes with it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax ordinal-suffix-mismatch --why "reason"
```

[All samples](README.md)
