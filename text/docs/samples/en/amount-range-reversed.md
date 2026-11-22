<!-- chaff-sample
rule: amount-range-reversed
genre: business/proposal
file: job-ad.md
-->

# An amount range whose upper end is below its lower end (`amount-range-reversed`)

**Where it helps:** job adverts, quotations, price lists, grant calls. Anywhere a price or a salary is given as a range.

## Original

```markdown chaff-before
# Bookkeeper (part-time), Harbour Street Bakery

We are a family bakery with two shops and a small wholesale round. We are looking for a bookkeeper to keep our accounts in order, three days a week.

## The role

- Record sales, supplier invoices and wages each week.
- Reconcile the two shop tills with the bank statement.
- Prepare the quarterly VAT return with our accountant.
- Chase the two wholesale customers who pay late.

## Pay and hours

- Salary: £24,000–£21,000 a year pro rata, depending on experience.
- Hours: Tuesday to Thursday, 9 am to 3 pm.
- Free bread, every day you are in.

To apply, send a short letter and your CV to the address on our website by 30 November.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal job-ad.md

job-ad.md   business/proposal · English   genre from --genre

─── line 14 ──────────────────────────────────────────────────

    - Salary: £24,000–£21,000 a yea

  ⚠  An amount range whose upper end is below its lower end

     The amount range "£24,000–£21,000" ends below where it starts
     When an amount range ends below where it starts ("$90,000–$70,000 a year", "minimum $90,000, maximum $70,000"), the reader has to ask which amount is right and what the range is. It happens in a salary or a quote when only one of the two amounts is edited, or when the two are written the wrong way round. Two amounts in one currency are read as a range when only a range mark (–, —) or "to" stands between them, including a range that writes its currency or its "k" once ("$90–70k"). Two amounts on one line labelled minimum and maximum are compared too.

     → Check both amounts, and correct the wrong one or write the smaller one first.

     Relax this rule:  npx chaffjs relax amount-range-reversed


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Bookkeeper (part-time), Harbour Street Bakery

We are a family bakery with two shops and a small wholesale round. We are looking for a bookkeeper to keep our accounts in order, three days a week.

## The role

- Record sales, supplier invoices and wages each week.
- Reconcile the two shop tills with the bank statement.
- Prepare the quarterly VAT return with our accountant.
- Chase the two wholesale customers who pay late.

## Pay and hours

- Salary: £21,000–£24,000 a year pro rata, depending on experience.
- Hours: Tuesday to Thursday, 9 am to 3 pm.
- Free bread, every day you are in.

To apply, send a short letter and your CV to the address on our website by 30 November.
```

## How it was fixed

The salary was first advertised as £21,000 to £24,000.
When the bakery redrafted the advert, the two figures swapped places, and the range now reads from high to low.
A candidate reading "£24,000–£21,000" cannot tell what is on offer: is the top of the range £24,000, or did someone mean to raise the bottom to £24,000?
Some will not apply rather than ask.

The fix writes the smaller amount first, so the range reads the way every reader expects.
If one of the two amounts was the one that changed, correct that amount instead.

## Settings

A reversed range is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  amount-range-reversed: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Two amounts are read as a range only when a range mark (–, —) or "to" stands between them, or when one line labels them minimum and maximum.
A sentence that describes a change ("the fee was reduced from $90 to $70") is not a range and is not reported, and neither are two amounts in different currencies.
The rule runs in every genre except literature.
A range of measurements (kg, °C) is the job of `quantity-range-reversed`, and a range of dates of `date-range-reversed`.

```text chaff-explain
$ npx chaffjs explain amount-range-reversed --genre business/proposal

  An amount range whose upper end is below its lower end   (amount-range-reversed)

  When an amount range ends below where it starts ("$90,000–$70,000 a year", "minimum $90,000, maximum $70,000"), the reader has to ask which amount is right and what the range is. It happens in a salary or a quote when only one of the two amounts is edited, or when the two are written the wrong way round. Two amounts in one currency are read as a range when only a range mark (–, —) or "to" stands between them, including a range that writes its currency or its "k" once ("$90–70k"). Two amounts on one line labelled minimum and maximum are compared too.

  How to fix: Check both amounts, and correct the wrong one or write the smaller one first.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax amount-range-reversed --why "reason"
```

[All samples](README.md)
