<!-- chaff-sample
rule: annual-pay-mismatch
genre: business/press-release
file: sales-coordinator.md
-->

# An example annual pay that is not the monthly pay and bonus (`annual-pay-mismatch`)

**Where it helps:** job postings, offer letters, recruitment pages. Any page that gives an example yearly pay next to the monthly pay and the bonus.

## Original

```markdown chaff-before
# Sales coordinator, Chicago office

Join the team that schedules deliveries and keeps our customers informed, from the first order to the final invoice.

| Item | Details |
| --- | --- |
| Salary | $4,800 a month |
| Bonus | Twice a year, three months' salary in total |
| Example annual pay | $75,000 (second year, with a monthly salary of $4,800) |
| Hours | 8:30 to 5:00, Monday to Friday |

We review applications as they arrive. Send your résumé to careers@example.com.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release sales-coordinator.md

sales-coordinator.md   business/press-release · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    xample annual pay | $75,000 (second year,

  ⚠  An example annual pay that is not the monthly pay and bonus

     $75,000 is not 15 months of the monthly pay $4,800 (twelve months and a bonus of three months)
     A posting's "Example annual pay: $75,000 (with a monthly salary of $4,800)" is a figure readers believe without working it out. It goes wrong when the monthly pay or the bonus is changed and the example is not, or a line is copied from another posting. An example annual pay is compared with twelve months of the monthly pay plus the bonus months ($4,800 with three months of bonus is $4,800 × 15 = $72,000). The monthly pay and the bonus are those on the annual line, else the one each the posting states. The annual figure may be rounded to its last written place ("$72k" to a thousand; plain digits to a thousand). When both the annual pay and the monthly pay are ranges, the low ends and the high ends are compared.

     → Check which of the monthly pay, the bonus and the annual figure is right, and correct the others. If the annual figure includes overtime or allowances, say so.

     Relax this rule:  npx chaffjs relax annual-pay-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Sales coordinator, Chicago office

Join the team that schedules deliveries and keeps our customers informed, from the first order to the final invoice.

| Item | Details |
| --- | --- |
| Salary | $4,800 a month |
| Bonus | Twice a year, three months' salary in total |
| Example annual pay | $72,000 (second year, with a monthly salary of $4,800) |
| Hours | 8:30 to 5:00, Monday to Friday |

We review applications as they arrive. Send your résumé to careers@example.com.
```

## How it was fixed

Twelve months at $4,800 and a bonus of three months' salary make fifteen months, $72,000.
The posting said $75,000: the line came from last year's posting, when the second-year salary was $5,000 a month.
The example pay is the figure a candidate quotes back in the interview, so a wrong one costs the recruiter an awkward conversation or the candidate a disappointment.

The fix works the example out again from the two lines above it.
If the example is meant to include overtime or allowances, say so on its line; chaff then leaves it alone.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  annual-pay-mismatch: relaxed
```

A posting is compared only when it states a monthly pay, a bonus in months ("three months' salary in total", or "no bonus") and an example annual pay.
An example rounded to its last written place is read as right ("$72k").
A posting that mentions overtime, allowances or commission on the example's line, an annual salary, a range on one side only, or a bonus given per payment ("one month each") is left alone.

```text chaff-explain
$ npx chaffjs explain annual-pay-mismatch --genre business/press-release

  An example annual pay that is not the monthly pay and bonus   (annual-pay-mismatch)

  A posting's "Example annual pay: $75,000 (with a monthly salary of $4,800)" is a figure readers believe without working it out. It goes wrong when the monthly pay or the bonus is changed and the example is not, or a line is copied from another posting. An example annual pay is compared with twelve months of the monthly pay plus the bonus months ($4,800 with three months of bonus is $4,800 × 15 = $72,000). The monthly pay and the bonus are those on the annual line, else the one each the posting states. The annual figure may be rounded to its last written place ("$72k" to a thousand; plain digits to a thousand). When both the annual pay and the monthly pay are ranges, the low ends and the high ends are compared.

  How to fix: Check which of the monthly pay, the bonus and the annual figure is right, and correct the others. If the annual figure includes overtime or allowances, say so.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax annual-pay-mismatch --why "reason"
```

[All samples](README.md)
