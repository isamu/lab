<!-- chaff-sample
rule: formula-amount-mismatch
genre: business/report
file: settlement-statement.md
-->

# An amount that is not what its label's formula gives (`formula-amount-mismatch`)

**Where it helps:** settlement statements, commission reports, fee schedules, invoices. Any line whose label says how its amount is worked out.

## Original

```markdown chaff-before
# Seller's settlement statement: 27 Linden Avenue

Closing date: 18 November 2026

| Item | Amount |
| --- | --- |
| Sale price | $324,000.00 |
| Commission (5% of the sale price) | $15,600.00 |
| Title and escrow fees | $1,250.00 |
| Payoff of the existing mortgage | $182,400.00 |

The net proceeds will be wired to the seller's account on the closing date.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report settlement-statement.md

settlement-statement.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    f the sale price) | $15,600.00 |

  ⚠  An amount that is not what its label's formula gives

     $15,600.00 is not "5% of the sale price" worked out on the sale price $324,000.00 ($16,200.00)
     When a statement writes how a fee is worked out in its label ("Commission (5% of the sale price)"), readers pay it without checking. It goes wrong when the price is changed and the fee is not, when a fixed part or the tax is left out, or when a digit is mistyped. When a label holds "rate% of name" (or "name × rate%") and its line ends in one amount, the rate is applied to the amount the document labels with that name (Sale price | $324,000.00), a fixed amount after "plus" is added, and the result is compared with the line's amount. A label saying tax is included adds the rate it states, else the one rate the document states beside a tax word.

     → Check the amount it is worked out from, the rate and any fixed part, and correct the amount or the label.

     Relax this rule:  npx chaffjs relax formula-amount-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Seller's settlement statement: 27 Linden Avenue

Closing date: 18 November 2026

| Item | Amount |
| --- | --- |
| Sale price | $324,000.00 |
| Commission (5% of the sale price) | $16,200.00 |
| Title and escrow fees | $1,250.00 |
| Payoff of the existing mortgage | $182,400.00 |

The net proceeds will be wired to the seller's account on the closing date.
```

## How it was fixed

Five percent of $324,000 is $16,200, and the statement said $15,600.
The house was listed at $312,000 and sold above the asking price; the commission was worked out on the listing price and not again.
The seller signs a statement like this without redoing the sums, and the agent is underpaid by $600 until someone notices.

The fix works the commission out on the sale price, as its label says.
If the agreed commission really was $15,600, the label is what to change ("Commission (agreed fixed fee)").

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  formula-amount-mismatch: relaxed
```

A label holding "rate% of name" or "name × rate%" is read, with a fixed part after "plus", and the rate is applied to the amount the document labels with that name.
Rounding to the cent or to the unit, down, up or to the nearest, is read as right.
Nothing is compared when no line or two lines give the named amount, when the currencies differ, or when the formula is written in a sentence.

```text chaff-explain
$ npx chaffjs explain formula-amount-mismatch --genre business/report

  An amount that is not what its label's formula gives   (formula-amount-mismatch)

  When a statement writes how a fee is worked out in its label ("Commission (5% of the sale price)"), readers pay it without checking. It goes wrong when the price is changed and the fee is not, when a fixed part or the tax is left out, or when a digit is mistyped. When a label holds "rate% of name" (or "name × rate%") and its line ends in one amount, the rate is applied to the amount the document labels with that name (Sale price | $324,000.00), a fixed amount after "plus" is added, and the result is compared with the line's amount. A label saying tax is included adds the rate it states, else the one rate the document states beside a tax word.

  How to fix: Check the amount it is worked out from, the rate and any fixed part, and correct the amount or the label.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax formula-amount-mismatch --why "reason"
```

[All samples](README.md)
