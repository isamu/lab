<!-- chaff-sample
rule: interest-mismatch
genre: business/report
file: savings-statement.md
-->

# An interest amount that is not the stated balance times the stated rate (`interest-mismatch`)

**Where it helps:** savings and deposit statements, loan statements, letters that show how interest was worked out. Any line that writes "balance × rate = interest".

## Original

```markdown chaff-before
# Your savings statement, September 2026

Easy Access Saver, account ending 4471.

| Date | Description | Amount |
| --- | --- | --- |
| Sep 4 | Transfer in | £250.00 |
| Sep 19 | Transfer in | £250.00 |

Interest for the month: average balance £6,240.00 × rate 0.30% = £1.56

Interest is paid into this account on the last working day of each month.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report savings-statement.md

savings-statement.md   business/report · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    £1.56

  ⚠  An interest amount that is not the stated balance times the stated rate

     The interest £1.56 is not the balance £6,240.00 at 0.30% (£18.72)
     When a deposit statement writes the interest out as "average balance $3,600.00 × rate 0.05% = $1.80", a reader can check the interest from the balance and the rate. It goes wrong when the rate is mistyped, when only the balance is corrected, or when another month's amount is copied. A line is read when it writes an amount after a balance word (balance, principal), ×, a percentage after a rate word (rate, APR), =, and the interest, and names the interest (interest). The rate is used as written. A rate marked for a period (APR, annual) is used only on a line that names the same period for the interest (for the year): it is never converted to a month or a day.

     → Check the balance and the rate, and work the interest out again.

     Relax this rule:  npx chaffjs relax interest-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your savings statement, September 2026

Easy Access Saver, account ending 4471.

| Date | Description | Amount |
| --- | --- | --- |
| Sep 4 | Transfer in | £250.00 |
| Sep 19 | Transfer in | £250.00 |

Interest for the month: average balance £6,240.00 × rate 0.025% = £1.56

Interest is paid into this account on the last working day of each month.
```

## How it was fixed

The statement shows its working so that the saver can check it, and the working does not check: £6,240.00 at 0.30% is £18.72, not £1.56.
The £1.56 is right; the rate is not.
0.30% is the account's rate for a year, and the month's interest is a twelfth of it, 0.025%.
A saver who multiplies the line out will think the bank has kept back seventeen pounds.

The fix writes the rate that was actually used for the month.
Another way is to say so on the line: "0.30% a year, for one month".
chaff never turns a yearly rate into a monthly one by itself; it reads the rate as written, unless the line names the same period for the interest.

## Settings

An interest line that does not check is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  interest-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A line is read when it writes a balance, ×, a rate, = and the interest, and names the interest.
Rounding down, to the nearest or up, to the cent, is read as right.
A line that also multiplies by days, interest after tax, and figures in a table are not read.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain interest-mismatch --genre business/report

  An interest amount that is not the stated balance times the stated rate   (interest-mismatch)

  When a deposit statement writes the interest out as "average balance $3,600.00 × rate 0.05% = $1.80", a reader can check the interest from the balance and the rate. It goes wrong when the rate is mistyped, when only the balance is corrected, or when another month's amount is copied. A line is read when it writes an amount after a balance word (balance, principal), ×, a percentage after a rate word (rate, APR), =, and the interest, and names the interest (interest). The rate is used as written. A rate marked for a period (APR, annual) is used only on a line that names the same period for the interest (for the year): it is never converted to a month or a day.

  How to fix: Check the balance and the rate, and work the interest out again.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax interest-mismatch --why "reason"
```

[All samples](README.md)
