<!-- chaff-sample
rule: duration-product-mismatch
genre: business/proposal
file: training-proposal.md
-->

# A number of sessions times their length that does not make the stated total (`duration-product-mismatch`)

**Where it helps:** course outlines, training proposals, coaching plans. Any page that gives the length of a session, how many there are and the total.

## Original

```markdown chaff-before
# Proposal: spreadsheet skills for the finance team

We propose a hands-on course for the 12 members of the finance team, held on site on Tuesday afternoons.

- Topics: formulas, lookups, pivot tables, charts
- Class hours: 90 minutes per session, 12 sessions, 20 hours in total
- Group size: up to 12 people
- Fee: £3,600 for the whole course

Every participant gets the course workbook and three months of email support.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal training-proposal.md

training-proposal.md   business/proposal · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    20 hours in total

  ⚠  A number of sessions times their length that does not make the stated total

     12 sessions of 90 minutes make 18 hours, but the total is given as 20 hours
     When a count of sessions, the length of one and the total are written together ("90 minutes per session, 15 sessions, 24 hours in total"), the reader cannot tell which of the three is right (15 sessions of 90 minutes make 22.5 hours). It happens when the count or the length is changed and the total is not. In one line, or one list, holding exactly one count, one length and one total, the count times the length is compared with the total.

     → Check which of the count, the length and the total is right and correct the rest.

     Relax this rule:  npx chaffjs relax duration-product-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: spreadsheet skills for the finance team

We propose a hands-on course for the 12 members of the finance team, held on site on Tuesday afternoons.

- Topics: formulas, lookups, pivot tables, charts
- Class hours: 90 minutes per session, 12 sessions, 18 hours in total
- Group size: up to 12 people
- Fee: £3,600 for the whole course

Every participant gets the course workbook and three months of email support.
```

## How it was fixed

Twelve sessions of 90 minutes make 18 hours, and the line said 20.
The course was first planned as ten two-hour sessions, then reshaped into shorter ones; the total was not worked out again.
The finance manager books rooms and cover for the hours in the proposal, and compares the fee per hour with other offers.

The fix gives the total the count and the length make.
If the 20 hours were what was agreed, change the count or the length instead; chaff only says the three do not fit together.

## Settings

The rule is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  duration-product-mismatch: relaxed
```

A line or a list is compared only when it holds exactly one count, one length and one total.
A rough length ("about 90 minutes") is left alone, and a rough total ("about 18 hours") may differ by less than the unit it is written in.

```text chaff-explain
$ npx chaffjs explain duration-product-mismatch --genre business/proposal

  A number of sessions times their length that does not make the stated total   (duration-product-mismatch)

  When a count of sessions, the length of one and the total are written together ("90 minutes per session, 15 sessions, 24 hours in total"), the reader cannot tell which of the three is right (15 sessions of 90 minutes make 22.5 hours). It happens when the count or the length is changed and the total is not. In one line, or one list, holding exactly one count, one length and one total, the count times the length is compared with the total.

  How to fix: Check which of the count, the length and the total is right and correct the rest.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax duration-product-mismatch --why "reason"
```

[All samples](README.md)
