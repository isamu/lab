<!-- chaff-sample
rule: gpa-mismatch
genre: business/report
file: transcript.md
-->

# A grade-point average the course rows do not give (`gpa-mismatch`)

**Where it helps:** transcripts, academic records, scholarship applications. Any record that writes a GPA under the courses it is worked out from.

## Original

```markdown chaff-before
# Academic transcript

Student: M. Laurent
Programme: Diploma in Culinary Arts, first year

| Course | Credits | Grade |
| --- | --- | --- |
| Food Safety | 4 | B |
| Nutrition | 2 | C |
| Pastry Practicum | 6 | A |
| Kitchen Management | 3 | B |

Grades are A (4), B (3), C (2) and D (1).

GPA: 3.40
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report transcript.md

transcript.md   business/report · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    3.40

  ⚠  A grade-point average the course rows do not give

     The GPA "3.40" is written, but the course grades and credits give 3.27
     The "GPA: 3.00" of a transcript is the sum of each course's grade points times its credits, divided by the sum of the credits. Readers trust it without working it out again. It goes wrong when one course's grade is corrected and the average is not, or when the average is copied from another term or another student. Which column is the course, the credits and the grade is decided by the heading words alone (Course, Credits, Grade). A grade's points come from the document's own grading key, a line naming grades with "A (4), B (3)", when it writes one, and otherwise from a scale of the language package's grade-point lexicon (A to F, S to D, plus and minus grades). When the document's grades fit several scales that give them different points (only A, B and C, with no S and no D), nothing is compared. A course with a grade that carries no points (Pass, W, In progress) is left out of both sums. A difference that rounding or cutting off to the written decimals can reach is not reported.

     → Check which of the course grades, their credits and the GPA is right, and correct the others.

     Relax this rule:  npx chaffjs relax gpa-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Academic transcript

Student: M. Laurent
Programme: Diploma in Culinary Arts, first year

| Course | Credits | Grade |
| --- | --- | --- |
| Food Safety | 4 | B |
| Nutrition | 2 | C |
| Pastry Practicum | 6 | A |
| Kitchen Management | 3 | B |

Grades are A (4), B (3), C (2) and D (1).

GPA: 3.27
```

## How it was fixed

Each grade's points times its credits add up to 49 over 15 credits, a GPA of 3.27.
The transcript said 3.40: Nutrition was first entered as a B, corrected to a C after the resit board, and the average was not worked out again.
A scholarship panel with a cut-off at 3.30 would admit the student on the written figure and refuse them on the real one.

The fix works the average out again from the four rows.
chaff uses the grading key the transcript writes ("A (4), B (3)"); without one, it uses a common scale only when the grades fit no other.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  gpa-mismatch: relaxed
```

Which column is the course, the credits and the grade is decided by the heading words alone.
A grade that carries no points (Pass, W, In progress) is left out of both sums, and a difference that rounding can reach is not reported.
A document that writes a term GPA, two different GPAs, or grades that fit scales giving different points is left alone.

```text chaff-explain
$ npx chaffjs explain gpa-mismatch --genre business/report

  A grade-point average the course rows do not give   (gpa-mismatch)

  The "GPA: 3.00" of a transcript is the sum of each course's grade points times its credits, divided by the sum of the credits. Readers trust it without working it out again. It goes wrong when one course's grade is corrected and the average is not, or when the average is copied from another term or another student. Which column is the course, the credits and the grade is decided by the heading words alone (Course, Credits, Grade). A grade's points come from the document's own grading key, a line naming grades with "A (4), B (3)", when it writes one, and otherwise from a scale of the language package's grade-point lexicon (A to F, S to D, plus and minus grades). When the document's grades fit several scales that give them different points (only A, B and C, with no S and no D), nothing is compared. A course with a grade that carries no points (Pass, W, In progress) is left out of both sums. A difference that rounding or cutting off to the written decimals can reach is not reported.

  How to fix: Check which of the course grades, their credits and the GPA is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax gpa-mismatch --why "reason"
```

[All samples](README.md)
