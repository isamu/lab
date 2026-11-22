<!-- chaff-sample
rule: announced-count-mismatch
genre: business/email
file: first-day.md
-->

# A list that does not have the number of items announced (`announced-count-mismatch`)

**Where it helps:** onboarding emails, instructions, reports, proposals. Anywhere a sentence says "the following three" and a list follows.

## Original

```markdown chaff-before
Subject: Before your first day

Hi Sam,

We are looking forward to having you with us on Monday. Before then, please complete the following three steps:

- Sign and return the employment contract.
- Send us your bank details for payroll.
- Fill in the emergency contact form.
- Upload a photo for your building pass.

Your manager will meet you at reception at 9:00. Bring a photo ID for the security desk.

Best wishes,
Grace
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email first-day.md

first-day.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    three steps:

  ⚠  A list that does not have the number of items announced

     "three steps" is announced, but the number of items in the list below is 4
     When a sentence says "the following three steps" and the list right below it has two or four, the reader has to check whether an item is missing or the count is wrong. It happens when an item is added or removed and the count is not updated. The number is compared with the items at the top level of the list only when the sentence right before the list announces it, with a word pointing ahead ("following", "below") or a colon at its end, and the number names what the list holds ("three steps", "two reasons"). A line right above the list that holds only a number and a heading word ("Three-line summary") is compared too. A line with a count in brackets after a label and names after the colon, split at commas ("Attendees (6): Tanaka, Suzuki, ..."), is checked the same way: the count against the names listed.

     → Check whether an item is missing. Add it, or correct the number in the announcement.

     Relax this rule:  npx chaffjs relax announced-count-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Before your first day

Hi Sam,

We are looking forward to having you with us on Monday. Before then, please complete the following four steps:

- Sign and return the employment contract.
- Send us your bank details for payroll.
- Fill in the emergency contact form.
- Upload a photo for your building pass.

Your manager will meet you at reception at 9:00. Bring a photo ID for the security desk.

Best wishes,
Grace
```

## How it was fixed

The email announces three steps and lists four.
The photo for the building pass was added to last year's template, and the count above it stayed the same.
A careful new starter wonders whether one of the four is optional, or whether a step is missing from a list that was meant to be different; a hurried one stops after three and has no pass on Monday.

All four steps are needed, so the fix corrects the count to "four steps".
When an item has been dropped by mistake instead, the fix is to put it back.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  announced-count-mismatch: relaxed
```

The number is compared with the top-level items of the list only when the sentence right before it announces the list, with a word pointing ahead ("following", "below") or a colon at its end, and the number names what the list holds ("three steps").
An estimate (about three), a rank (the first three), a choice ("choose two") and a sentence with two numbers are not compared.
A line such as "Attendees (6): …" is checked too, the count against the names after the colon.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain announced-count-mismatch --genre business/email

  A list that does not have the number of items announced   (announced-count-mismatch)

  When a sentence says "the following three steps" and the list right below it has two or four, the reader has to check whether an item is missing or the count is wrong. It happens when an item is added or removed and the count is not updated. The number is compared with the items at the top level of the list only when the sentence right before the list announces it, with a word pointing ahead ("following", "below") or a colon at its end, and the number names what the list holds ("three steps", "two reasons"). A line right above the list that holds only a number and a heading word ("Three-line summary") is compared too. A line with a count in brackets after a label and names after the colon, split at commas ("Attendees (6): Tanaka, Suzuki, ..."), is checked the same way: the count against the names listed.

  How to fix: Check whether an item is missing. Add it, or correct the number in the announcement.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax announced-count-mismatch --why "reason"
```

[All samples](README.md)
