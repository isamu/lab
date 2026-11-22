<!-- chaff-sample
rule: meter-usage-mismatch
genre: business/report
file: electricity-bill.md
-->

# The meter readings' difference is not the usage (`meter-usage-mismatch`)

**Where it helps:** electricity, gas and water bills, landlord recharges, meter reports. Any statement that gives two readings and the usage between them.

## Original

```markdown chaff-before
# Electricity statement: Unit 7, Kingsway Trading Estate

Billing period: 1 October to 31 October 2026

Current reading: 48,650 kWh
Previous reading: 47,900 kWh
Electricity used: 720 kWh

Charges are worked out from the electricity used at the rate in your tenancy agreement.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report electricity-bill.md

electricity-bill.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    48,650 kWh

  ✖  The meter readings' difference is not the usage

     The readings' difference (48,650 kWh − 47,900 kWh = 750) is not the usage 720 kWh
     On an electricity or water bill the usage is the current meter reading minus the previous one (times the multiplier, when there is one), and the charges are worked out from it. When a reading is copied wrong, the reader cannot tell whether the usage or the charges are right. When one section has one current reading, one previous reading and one usage, written as "Current reading: 48,650" lines or in a table with the names as row or column headings, the difference is compared with the usage. The names are in the language package's meter-reading-label lexicon.

     → Check both readings against the meter record and correct the readings or the usage. If the usage changes, correct the charges with it.

     Relax this rule:  npx chaffjs relax meter-usage-mismatch


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Electricity statement: Unit 7, Kingsway Trading Estate

Billing period: 1 October to 31 October 2026

Current reading: 48,620 kWh
Previous reading: 47,900 kWh
Electricity used: 720 kWh

Charges are worked out from the electricity used at the rate in your tenancy agreement.
```

## How it was fixed

48,650 less 47,900 is 750, and the statement charges for 720.
The current reading was typed from the meter photo with a 2 read as a 5; the usage had been worked out from the right figure.
A tenant who checks the readings cannot tell whether the usage or the charges are wrong, and the landlord has a dispute over one digit.

The fix corrects the current reading to what the meter showed, 48,620.
If the reading is right and the usage is wrong, correct the usage and the charges with it.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  meter-usage-mismatch: relaxed
```

One section with one current reading, one previous reading and one usage is compared, written as "Current reading: 48,620" lines or in a table.
A multiplier is applied when one is given, and the usage may be rounded to its last digit.
A section with a day and a night meter, values in different units, or a meter replaced during the period is left alone; a rollover is allowed for only when the section says the meter rolled over.

```text chaff-explain
$ npx chaffjs explain meter-usage-mismatch --genre business/report

  The meter readings' difference is not the usage   (meter-usage-mismatch)

  On an electricity or water bill the usage is the current meter reading minus the previous one (times the multiplier, when there is one), and the charges are worked out from it. When a reading is copied wrong, the reader cannot tell whether the usage or the charges are right. When one section has one current reading, one previous reading and one usage, written as "Current reading: 48,650" lines or in a table with the names as row or column headings, the difference is compared with the usage. The names are in the language package's meter-reading-label lexicon.

  How to fix: Check both readings against the meter record and correct the readings or the usage. If the usage changes, correct the charges with it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax meter-usage-mismatch --why "reason"
```

[All samples](README.md)
