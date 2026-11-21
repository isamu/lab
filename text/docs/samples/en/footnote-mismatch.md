<!-- chaff-sample
rule: footnote-mismatch
genre: business/report
file: annual-review.md
-->

# A note mark with no note, or a note nothing points to (`footnote-mismatch`)

**Where it helps:** reports, white papers, articles, policies. Any document with footnotes.

## Original

```markdown chaff-before
# Annual review of the volunteer programme

## Reach

Volunteers ran 340 reading sessions in 18 schools this year[^1].
Attendance rose by 22% over the previous year[^2].

[^1]: Sessions cancelled for school closures are not counted.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report annual-review.md

annual-review.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    er the previous year[^2]. [^1]: Sessions ca

  ⚠  A note mark with no note, or a note nothing points to

     There is no note for "[^2]"
     When the text says "[^3]" or "※3" and there is no note 3, the reader looks for a note that is not there; a note nothing points to cannot be tied to any word. It happens when a note is deleted or the notes are renumbered and only one side is changed. Matching the marks against the notes' numbers is mechanical.

     → Add the note or remove the mark. If the notes were renumbered, renumber the marks to match.

     Relax this rule:  npx chaffjs relax footnote-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Annual review of the volunteer programme

## Reach

Volunteers ran 340 reading sessions in 18 schools this year[^1].
Attendance rose by 22% over the previous year[^2].

[^1]: Sessions cancelled for school closures are not counted.
[^2]: Attendance is the number of pupils signed in at each session.
```

## How it was fixed

The second figure, a rise in attendance of 22%, points to note 2, but the review has only note 1.
The note probably said how attendance was counted, and it was lost when the notes were edited.
A trustee reading the review cannot tell what the figure measures, and it is the one figure that shows the programme growing.

The fix adds the missing note.
chaff also reports a note that nothing in the text points to.
It reads Markdown footnotes (`[^1]`) and notes marked with ※ and a number.

## Settings

A mark without its note is a warning at the default level and a note at `relaxed`.

If your notes are kept in another file, relax it:

```yaml chaff-settings
rules:
  footnote-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain footnote-mismatch --genre business/report

  A note mark with no note, or a note nothing points to   (footnote-mismatch)

  When the text says "[^3]" or "※3" and there is no note 3, the reader looks for a note that is not there; a note nothing points to cannot be tied to any word. It happens when a note is deleted or the notes are renumbered and only one side is changed. Matching the marks against the notes' numbers is mechanical.

  How to fix: Add the note or remove the mark. If the notes were renumbered, renumber the marks to match.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax footnote-mismatch --why "reason"
```

[All samples](README.md)
