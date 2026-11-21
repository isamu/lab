<!-- chaff-sample
rule: range-notation-consistency
genre: business/proposal
file: course.md
-->

# Ranges written with two marks (`range-notation-consistency`)

**Where it helps:** proposals, timetables, price lists. Any document with several ranges of numbers.

## Original

```markdown chaff-before
# Proposal: first aid course for shop staff

Two of our shops had no trained first aider on duty for most of last year.

Each group would have 8–12 people, so everyone can practise on the training dummies.
The course runs over 6–7 hours with a lunch break, and ends with a short test.
We would run 3–4 courses a year, so that new staff are trained within their first months.
The training company quotes 450-500 pounds a course, depending on the size of the group.

The shops would close the training room for the day, but no shop would close its doors.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal course.md

course.md   business/proposal · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    ning company quotes 450-500 pounds a course, de

  ·  Ranges written with two marks

     The range "450-500" here, where the document usually writes ranges like "8–12" (1 of 4)
     When one document writes ranges with two marks ("10–20" and "10-20", "10〜20" and "10-20"), the reader wonders whether the difference means something, a hyphen being also a minus sign or part of a number. It happens when texts are pasted together or typed by different people. chaff does not decide which mark is right; it points at the one the document uses less.

     → Match the mark the rest of the document uses. If the team has decided, write it in the style guide.

     Relax this rule:  npx chaffjs relax range-notation-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: first aid course for shop staff

Two of our shops had no trained first aider on duty for most of last year.

Each group would have 8–12 people, so everyone can practise on the training dummies.
The course runs over 6–7 hours with a lunch break, and ends with a short test.
We would run 3–4 courses a year, so that new staff are trained within their first months.
The training company quotes 450–500 pounds a course, depending on the size of the group.

The shops would close the training room for the day, but no shop would close its doors.
```

## How it was fixed

Three ranges are written with an en dash, "8–12", and the price, copied from the training company's email, with a hyphen, "450-500".
A hyphen is also a minus sign and part of codes, so the reader stops to check what it means here, and the page looks pasted together.

The fix writes the price range with the en dash, like the others.
chaff does not decide which mark is right; a document written mostly with hyphens would have the en dashes pointed at.

## Settings

The rarer mark is reported while it is at most a third of the ranges (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Dates (2026-10-02), phone numbers, times, versions and scores (3-2) are not read as ranges, and ranges written in words ("10 to 20") are not compared.

To stop checking:

```yaml chaff-settings
rules:
  range-notation-consistency: off
```

```text chaff-explain
$ npx chaffjs explain range-notation-consistency --genre business/proposal

  Ranges written with two marks   (range-notation-consistency)

  When one document writes ranges with two marks ("10–20" and "10-20", "10〜20" and "10-20"), the reader wonders whether the difference means something, a hyphen being also a minus sign or part of a number. It happens when texts are pasted together or typed by different people. chaff does not decide which mark is right; it points at the one the document uses less.

  How to fix: Match the mark the rest of the document uses. If the team has decided, write it in the style guide.

  Levels:
    strict   reported when the less common mark is 49% of the ranges or less
  → normal   reported when the less common mark is 34% of the ranges or less
    relaxed  reported when the less common mark is 20% of the ranges or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax range-notation-consistency --why "reason"
```

[All samples](README.md)
