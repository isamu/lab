<!-- chaff-sample
rule: tier-threshold-mismatch
genre: business/report
file: rewards-statement.md
-->

# A member's tier that their own points or nights do not reach (`tier-threshold-mismatch`)

**Where it helps:** loyalty statements, membership letters, any document that states a tier with the value that decides it.

## Original

```markdown chaff-before
# Your Harbor Rewards statement for 2026

- Status: Gold
- Nights stayed last year: 18 nights
- Points balance: 64,200 points

Your status runs until March 31, 2027.

## Status levels

- Silver: 10 nights or more stayed last year
- Gold: 25 nights or more stayed last year
- Platinum: 50 nights or more stayed last year
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report rewards-statement.md

rewards-statement.md   business/report · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    18 nights

  ⚠  A member's tier that their own points or nights do not reach

     The tier "Gold" needs "25 nights or more stayed last year", but "18 nights" falls in "Silver"
     On a points or hotel statement, when the tier table says "Gold: 50,000 points or more" and a member stated as "Tier: Gold" has "Points earned last year: 42,400 points", the reader cannot tell whether the tier or the points are right. It happens when the value is updated and the tier is not, or when another member's value is copied. The bands of the document's tier table (the tier's name in the first column, its threshold in another) or tier list ("Gold: 20 nights or more stayed last year") are compared with the tier and the value stated in one section. A tier written with its lower end only (20 nights or more) is read as running up to where the next tier starts.

     → Check the member's value against the tier thresholds, and correct the tier or the value, whichever is wrong.

     Relax this rule:  npx chaffjs relax tier-threshold-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your Harbor Rewards statement for 2026

- Status: Silver
- Nights stayed last year: 18 nights
- Points balance: 64,200 points

Your status runs until March 31, 2027.

## Status levels

- Silver: 10 nights or more stayed last year
- Gold: 25 nights or more stayed last year
- Platinum: 50 nights or more stayed last year
```

## How it was fixed

The statement says Gold, but the member stayed 18 nights, and Gold needs 25.
Eighteen nights is Silver.
The member may expect Gold benefits at the front desk and be refused, or the nights are wrong and the member is owed a better tier.

Here the nights were right, so the fix corrects the tier.
chaff reads the tier list's bands and compares them with the tier and the value stated together.
A balance of points, or what the next tier needs, is not counted as the member's value.

## Settings

A tier the member's value does not reach is a warning at the default level, an error at `strict` and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  tier-threshold-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain tier-threshold-mismatch --genre business/report

  A member's tier that their own points or nights do not reach   (tier-threshold-mismatch)

  On a points or hotel statement, when the tier table says "Gold: 50,000 points or more" and a member stated as "Tier: Gold" has "Points earned last year: 42,400 points", the reader cannot tell whether the tier or the points are right. It happens when the value is updated and the tier is not, or when another member's value is copied. The bands of the document's tier table (the tier's name in the first column, its threshold in another) or tier list ("Gold: 20 nights or more stayed last year") are compared with the tier and the value stated in one section. A tier written with its lower end only (20 nights or more) is read as running up to where the next tier starts.

  How to fix: Check the member's value against the tier thresholds, and correct the tier or the value, whichever is wrong.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax tier-threshold-mismatch --why "reason"
```

[All samples](README.md)
