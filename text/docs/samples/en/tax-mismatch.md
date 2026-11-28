<!-- chaff-sample
rule: tax-mismatch
genre: business/proposal
file: invoice.md
-->

# A tax that is not its rate of the subtotal (`tax-mismatch`)

**Where it helps:** invoices, quotations, receipts, price lists. Anywhere a VAT or sales tax line is worked out by hand.

## Original

```markdown chaff-before
# Invoice INV-2026-0418

Bramble Design Studio, for Harbour Lane Bakery.

| Item | Amount |
| --- | --- |
| Logo refresh | £1,200.00 |
| Menu board design, three boards | £450.00 |
| Printed loyalty cards, 1,000 | £180.00 |
| Subtotal | £1,830.00 |
| VAT (20%) | £396.00 |
| Total | £2,226.00 |

Please pay by bank transfer within 30 days, quoting the invoice number.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal invoice.md

invoice.md   business/proposal · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    396.00 |

  ✖  A tax that is not its rate of the subtotal

     The tax £396.00 is not 20% of the amount above it (£366.00)
     When the "Sales tax (10%)" of a quote or an invoice is not 10% of the subtotal, the reader has to work the tax out again and can no longer trust the total. It happens when the rate is applied to the total instead of the subtotal, or when the subtotal is changed and the tax is not. In a list or a table, the amount of a line starting with a tax word (Tax, Sales tax, VAT) and giving a rate is compared with that rate of the subtotal line above it (or, with no subtotal line, of the sum of the items above). In a price list with a price before tax and a price with tax ("Pack price (excl. tax)", "Pack price (incl. 8% tax)"), each row's price with tax is compared with the price before tax plus the rate. The rate is the one in the heading of the price with tax, else the one the document gives ("8% sales tax"). A service charge line giving a rate is compared the same way, and a tax below it may be on the subtotal with the service charge added.

     → Check the subtotal and the rate and work the tax out again. Correct the total with it.

     Relax this rule:  npx chaffjs relax tax-mismatch


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Invoice INV-2026-0418

Bramble Design Studio, for Harbour Lane Bakery.

| Item | Amount |
| --- | --- |
| Logo refresh | £1,200.00 |
| Menu board design, three boards | £450.00 |
| Printed loyalty cards, 1,000 | £180.00 |
| Subtotal | £1,830.00 |
| VAT (20%) | £366.00 |
| Total | £2,196.00 |

Please pay by bank transfer within 30 days, quoting the invoice number.
```

## How it was fixed

Twenty per cent of £1,830 is £366, but the VAT line says £396: one digit slipped when it was typed in.
The total was then worked out from the wrong tax, so it adds up perfectly and nothing on the page looks wrong.
The bakery would pay £30 too much, and its accountant would find the difference at the VAT return, months later, and ask for a corrected invoice.

The fix works the tax out again from the subtotal and rate, £366.00, and corrects the total with it, £2,196.00.
Because the total was built on the tax, checking the total alone would not have caught this; the tax line itself has to be checked.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  tax-mismatch: relaxed
```

A line starting with a tax word (Tax, Sales tax, VAT) and giving a rate is compared with that rate of the subtotal above it, or of the sum of the items when there is no subtotal.
Rounding down, to the nearest or up is all read as right.
A tax line with no rate, tax included in a price ("incl. VAT"), lines at different rates, and a discount or a shipping line between the subtotal and the tax are not compared, and neither is a tax written in a sentence.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain tax-mismatch --genre business/proposal

  A tax that is not its rate of the subtotal   (tax-mismatch)

  When the "Sales tax (10%)" of a quote or an invoice is not 10% of the subtotal, the reader has to work the tax out again and can no longer trust the total. It happens when the rate is applied to the total instead of the subtotal, or when the subtotal is changed and the tax is not. In a list or a table, the amount of a line starting with a tax word (Tax, Sales tax, VAT) and giving a rate is compared with that rate of the subtotal line above it (or, with no subtotal line, of the sum of the items above). In a price list with a price before tax and a price with tax ("Pack price (excl. tax)", "Pack price (incl. 8% tax)"), each row's price with tax is compared with the price before tax plus the rate. The rate is the one in the heading of the price with tax, else the one the document gives ("8% sales tax"). A service charge line giving a rate is compared the same way, and a tax below it may be on the subtotal with the service charge added.

  How to fix: Check the subtotal and the rate and work the tax out again. Correct the total with it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax tax-mismatch --why "reason"
```

[All samples](README.md)
