<!-- chaff-sample
rule: total-mismatch
genre: business/proposal
file: kitchen-quote.md
-->

# A total that is not the sum of its items (`total-mismatch`)

**Where it helps:** quotations, invoices, budgets, expense claims. Any table or list that ends in a total.

## Original

```markdown chaff-before
# Quotation: kitchen refit, 14 Elm Road

Prepared for the owners of 14 Elm Road. All prices include materials and labour.

| Item | Amount |
| --- | --- |
| Removal of the old units and worktops | £850 |
| Base and wall units, oak finish | £4,200 |
| Quartz worktops, fitted | £2,350 |
| Plumbing and electrical connections | £1,100 |
| Tiling, splashback | £640 |
| Total | £8,500 |

The work takes about two weeks. This quotation is valid for 30 days.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal kitchen-quote.md

kitchen-quote.md   business/proposal · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    8,500 |

  ✖  A total that is not the sum of its items

     The total £8,500 is not the sum of its items (£9,140)
     When the total of a quote or an invoice is not the sum of the amounts listed above it, the reader has to add them up again to find out which is right. It happens when a line is added or removed and the total is not updated. In a list or a table, a line starting with a total word (Total, Subtotal) is compared with the sum of the amounts in the same unit and column above it. A total with a word that the header of the table's first column, or of the column the total holds its number in, names ("Total deductions" under "Deduction", "Total credits earned" in the "Credits" column) is read as a total line too, and so is a total naming the span it covers ("Total for the year", "Year total", "Annual total"). Under a header that names nothing ("Item"), a "Total deductions" on the table's last row is read too, when no row above it is a total or a gross or net amount and the table has one column of amounts. A total written in a sentence, as contracts do ("$6,000 for hosting and $3,000 for support, for a total of $9,000", "$8 per month, made up of …", "a total of $12,000 — $5,000 for design and $6,000 for development"), is compared with the amounts in the same unit listed in that sentence, and with the amounts of the next sentence when it opens with a breakdown phrase ("This consists of …"). When there is more than one way to add them up, such as a grand total after a subtotal and tax, it is pointed out only when none of them matches.

     → Check which is right, the items or the total, and correct the other.

     Relax this rule:  npx chaffjs relax total-mismatch


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Quotation: kitchen refit, 14 Elm Road

Prepared for the owners of 14 Elm Road. All prices include materials and labour.

| Item | Amount |
| --- | --- |
| Removal of the old units and worktops | £850 |
| Base and wall units, oak finish | £4,200 |
| Quartz worktops, fitted | £2,350 |
| Plumbing and electrical connections | £1,100 |
| Tiling, splashback | £640 |
| Total | £9,140 |

The work takes about two weeks. This quotation is valid for 30 days.
```

## How it was fixed

The owners asked for a tiled splashback after the first draft, and the line was added without updating the total.
£8,500 is the sum of the first four lines; the splashback's £640 is missing from it.
A homeowner comparing three quotes is likely to look only at the bottom line, and a builder who signs at £8,500 has either given the tiling away or has an awkward conversation ahead.

The fix adds the lines up again and writes the total they give, £9,140.
If the total was the agreed price and a line is wrong instead, correct the line.
Either way, the table and its total now say the same thing.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  total-mismatch: relaxed
```

In a table or a list, a line starting with a total word (Total, Subtotal) is compared with the sum of the amounts above it, in the same column and the same currency.
When a document can be added up in more than one way (a subtotal, then a grand total), it is reported only when none of the ways gives the total.
A total of something else ("Total tax" under "Item", "Total area") is not compared.
The rule runs in every genre except literature.
A tax line that is not its rate of the subtotal is the job of `tax-mismatch`, and quantity times unit price of `line-amount-mismatch`.

```text chaff-explain
$ npx chaffjs explain total-mismatch --genre business/proposal

  A total that is not the sum of its items   (total-mismatch)

  When the total of a quote or an invoice is not the sum of the amounts listed above it, the reader has to add them up again to find out which is right. It happens when a line is added or removed and the total is not updated. In a list or a table, a line starting with a total word (Total, Subtotal) is compared with the sum of the amounts in the same unit and column above it. A total with a word that the header of the table's first column, or of the column the total holds its number in, names ("Total deductions" under "Deduction", "Total credits earned" in the "Credits" column) is read as a total line too, and so is a total naming the span it covers ("Total for the year", "Year total", "Annual total"). Under a header that names nothing ("Item"), a "Total deductions" on the table's last row is read too, when no row above it is a total or a gross or net amount and the table has one column of amounts. A total written in a sentence, as contracts do ("$6,000 for hosting and $3,000 for support, for a total of $9,000", "$8 per month, made up of …", "a total of $12,000 — $5,000 for design and $6,000 for development"), is compared with the amounts in the same unit listed in that sentence, and with the amounts of the next sentence when it opens with a breakdown phrase ("This consists of …"). When there is more than one way to add them up, such as a grand total after a subtotal and tax, it is pointed out only when none of them matches.

  How to fix: Check which is right, the items or the total, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax total-mismatch --why "reason"
```

[All samples](README.md)
