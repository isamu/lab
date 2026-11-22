<!-- chaff-sample
rule: summary-fact-mismatch
genre: business/report
file: partner-seminar.md
-->

# A summary value that differs from the body (`summary-fact-mismatch`)

**Where it helps:** event notices, reports, proposals and emails with a summary at the top.

## Original

```markdown chaff-before
# Partner seminar, autumn 2026

- Date: October 8, 2026
- Place: Harbor Hall, Room 3
- Registration deadline: September 18, 2026

## Programme

- 1:30 PM Welcome and product roadmap
- 2:45 PM Workshops
- 4:30 PM Drinks

## How to register

Register on the partner portal with your partner ID. We confirm each place by email within two working days.

- Registration deadline: September 25, 2026
- Fee: free for registered partners
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report partner-seminar.md

partner-seminar.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    September 18, 2026

  ⚠  A summary value that differs from the body

     The summary gives "Registration deadline" as September 18, 2026, but the body gives September 25, 2026
     The opening and the summary are read by people who never read the body. A value there that differs from the body sends them away with the wrong one. It happens when the body is corrected and the summary is not. Values written as "Item: value" or "The item is value" before the first heading, or in a section headed Summary, Abstract or Overview, are compared with the body's values for the same item, and so is a count with no label, by the verb and the words of what it counts ("We gained 52 new customers"). A summary's "lowered the error rate from 2.4% to 1.6%" is paired with the two values the body gives the same item under two conditions (before and after, without and with, 2025 and 2026). The date of an event in the opening ("will release it on November 9, 2026") is compared with a body sentence that has a word for the same event (release, launch, held) and one date. It is pointed out only when the body gives one value throughout and the summary gives another.

     → Check which is right, the summary or the body, and correct the other.

     Relax this rule:  npx chaffjs relax summary-fact-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Partner seminar, autumn 2026

- Date: October 8, 2026
- Place: Harbor Hall, Room 3
- Registration deadline: September 25, 2026

## Programme

- 1:30 PM Welcome and product roadmap
- 2:45 PM Workshops
- 4:30 PM Drinks

## How to register

Register on the partner portal with your partner ID. We confirm each place by email within two working days.

- Registration deadline: September 25, 2026
- Fee: free for registered partners
```

## How it was fixed

The summary at the top gives the registration deadline as September 18, and the registration section gives September 25.
Many partners read only the top, and those who planned around the earlier date may give up a week early.
It happens when the body is corrected and the summary is not.

The organisers had moved the deadline to September 25, so the fix corrects the summary.
chaff compares values written as "Item: value" before the first heading, or under a heading such as Summary, with the body's values for the same item.
It says nothing when the body itself gives the item more than one value.

## Settings

A summary value that differs from the body is a warning at the default level and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  summary-fact-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain summary-fact-mismatch --genre business/report

  A summary value that differs from the body   (summary-fact-mismatch)

  The opening and the summary are read by people who never read the body. A value there that differs from the body sends them away with the wrong one. It happens when the body is corrected and the summary is not. Values written as "Item: value" or "The item is value" before the first heading, or in a section headed Summary, Abstract or Overview, are compared with the body's values for the same item, and so is a count with no label, by the verb and the words of what it counts ("We gained 52 new customers"). A summary's "lowered the error rate from 2.4% to 1.6%" is paired with the two values the body gives the same item under two conditions (before and after, without and with, 2025 and 2026). The date of an event in the opening ("will release it on November 9, 2026") is compared with a body sentence that has a word for the same event (release, launch, held) and one date. It is pointed out only when the body gives one value throughout and the summary gives another.

  How to fix: Check which is right, the summary or the body, and correct the other.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax summary-fact-mismatch --why "reason"
```

[All samples](README.md)
