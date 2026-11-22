<!-- chaff-sample
rule: line-amount-mismatch
genre: business/proposal
file: invoice.md
-->

# Quantity times unit price is not the line amount (`line-amount-mismatch`)

**Where it helps:** invoices, quotations, purchase orders, delivery notes. Any table with a quantity, a price and an amount.

## Original

```markdown chaff-before
# Invoice 1047

Greenleaf Office Supply, for Maple Street Dental.

| Item | Quantity | Unit price | Amount |
| --- | --- | --- | --- |
| Copy paper, case of 10 reams | 6 | $42.00 | $252.00 |
| Toner cartridge, black | 4 | $68.50 | $264.00 |
| Appointment cards, box of 500 | 3 | $24.00 | $72.00 |
| Total | | | $588.00 |

Payment is due within 30 days. Thank you for your order.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal invoice.md

invoice.md   business/proposal · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    $264.00 |

  ✖  Quantity times unit price is not the line amount

     The amount $264.00 is not quantity × unit price (4 × $68.50 = $274.00)
     When quantity times unit price in a line of a quote or an invoice is not the line's amount, the reader has to ask which one is right. It happens when the quantity or the price is changed and the amount is not. In a table with quantity, unit price and amount columns, each row's quantity (the number its cell starts with) times its unit price is compared with its amount. In a catalog with count per pack, unit price and pack price columns, count per pack × unit price is compared with the pack price. A product written in brackets in the item cell (Membership dues (24 members × $40)), one amount of money and one count in a counting word, is compared with the row's one amount too.

     → Check which of the quantity, the price and the amount is right and correct the others. Correct the subtotal and the total with them.

     Relax this rule:  npx chaffjs relax line-amount-mismatch


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Invoice 1047

Greenleaf Office Supply, for Maple Street Dental.

| Item | Quantity | Unit price | Amount |
| --- | --- | --- | --- |
| Copy paper, case of 10 reams | 6 | $42.00 | $252.00 |
| Toner cartridge, black | 4 | $68.50 | $274.00 |
| Appointment cards, box of 500 | 3 | $24.00 | $72.00 |
| Total | | | $598.00 |

Payment is due within 30 days. Thank you for your order.
```

## How it was fixed

Four toner cartridges at $68.50 come to $274.00, not $264.00.
The total adds up the amounts as written, so it is wrong by the same $10 and still looks right: the column adds up, and nobody multiplies the rows again.
The supplier loses $10 on this invoice; on an order where the slip went the other way, the dental practice would be the one paying too much.

The fix multiplies the row again, $274.00, and corrects the total with it, $598.00.
If the price was what changed (a discount agreed on the phone), correct the unit price instead, so that every row still multiplies out.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  line-amount-mismatch: relaxed
```

In a table with quantity, unit price and amount columns, each row's quantity times its price is compared with its amount.
Rounding down, to the nearest or up is all read as right.
A row priced per a unit of time ($100/hour) with its quantity in another unit, a row with a discount or a tax rate in another column, and a delivery note with two quantity columns of one kind are not compared.
The rule runs in every genre except literature.
The total itself is checked by `total-mismatch`.

```text chaff-explain
$ npx chaffjs explain line-amount-mismatch --genre business/proposal

  Quantity times unit price is not the line amount   (line-amount-mismatch)

  When quantity times unit price in a line of a quote or an invoice is not the line's amount, the reader has to ask which one is right. It happens when the quantity or the price is changed and the amount is not. In a table with quantity, unit price and amount columns, each row's quantity (the number its cell starts with) times its unit price is compared with its amount. In a catalog with count per pack, unit price and pack price columns, count per pack × unit price is compared with the pack price. A product written in brackets in the item cell (Membership dues (24 members × $40)), one amount of money and one count in a counting word, is compared with the row's one amount too.

  How to fix: Check which of the quantity, the price and the amount is right and correct the others. Correct the subtotal and the total with them.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax line-amount-mismatch --why "reason"
```

[All samples](README.md)
