<!-- chaff-sample
rule: required-listed-as-preferred
genre: business/report
file: job-posting.md
-->

# A required skill listed again as preferred (`required-listed-as-preferred`)

**Where it helps:** job postings, role descriptions, calls for suppliers. Any list split into what is needed and what is welcome.

## Original

```markdown chaff-before
# Job posting: Office Coordinator

## Required

- Two years of experience running an office or a front desk
- Confident use of spreadsheets and shared calendars
- A full driving licence

## Preferred

- Experience planning events for 50 people or more
- A full driving licence
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report job-posting.md

job-posting.md   business/report · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    r 50 people or more - A full driving lice

  ⚠  A required skill listed again as preferred

     "A full driving licence" is also listed as required (A full driving licence)
     When a posting lists a qualification under "Required" and again under "Preferred", the reader cannot tell whether it is a must or only welcome, and cannot decide whether to apply. It happens when one line is copied in place of the one that was meant to be rewritten. The list items under a required heading or label (Required, Requirements, Must have) are compared with those under a preferred one (Preferred, Nice to have, Bonus points), and an item in both is pointed out where it is preferred. A Japanese heading whose kind word is followed by what the list is of (歓迎する経験・資格, 必須の経験) is read the same way; one followed by another word (歓迎会のご案内, a welcome party) is not. Case, full and half width and punctuation are ignored. A length of experience (3+ years) is taken out before comparing, and the two are read as the same item unless the preferred one asks for more experience.

     → Remove it from the preferred list if it is a must, or from the required list if it is only welcome. If the preferred item asks for more, say how much more, such as "5+ years".

     Relax this rule:  npx chaffjs relax required-listed-as-preferred


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Job posting: Office Coordinator

## Required

- Two years of experience running an office or a front desk
- Confident use of spreadsheets and shared calendars
- A full driving licence

## Preferred

- Experience planning events for 50 people or more
- First aid training
```

## How it was fixed

A full driving licence is listed under "Required" and again under "Preferred".
A candidate without one cannot tell whether to apply: the posting says both that they cannot and that it would only be nice.
This happens when a line is copied into the preferred list in place of the one that was meant to be rewritten.

The fix keeps the licence where it belongs, under "Required", and writes the preferred item that was meant.
If the preferred item asks for more than the required one, say how much more ("five years" rather than "two"); chaff reads that as a higher level and does not report it.

## Settings

An item in both lists is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your postings repeat an item on purpose, relax it:

```yaml chaff-settings
rules:
  required-listed-as-preferred: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature.

```text chaff-explain
$ npx chaffjs explain required-listed-as-preferred --genre business/report

  A required skill listed again as preferred   (required-listed-as-preferred)

  When a posting lists a qualification under "Required" and again under "Preferred", the reader cannot tell whether it is a must or only welcome, and cannot decide whether to apply. It happens when one line is copied in place of the one that was meant to be rewritten. The list items under a required heading or label (Required, Requirements, Must have) are compared with those under a preferred one (Preferred, Nice to have, Bonus points), and an item in both is pointed out where it is preferred. A Japanese heading whose kind word is followed by what the list is of (歓迎する経験・資格, 必須の経験) is read the same way; one followed by another word (歓迎会のご案内, a welcome party) is not. Case, full and half width and punctuation are ignored. A length of experience (3+ years) is taken out before comparing, and the two are read as the same item unless the preferred one asks for more experience.

  How to fix: Remove it from the preferred list if it is a must, or from the required list if it is only welcome. If the preferred item asks for more, say how much more, such as "5+ years".

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax required-listed-as-preferred --why "reason"
```

[All samples](README.md)
