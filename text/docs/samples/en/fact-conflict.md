<!-- chaff-sample
rule: fact-conflict
genre: business/email
file: workshop-invite.md
-->

# One item given two different values (`fact-conflict`)

**Where it helps:** invitations, notices, briefs, terms. Any document that repeats a date or a price, where one copy is changed and the other is not.

## Original

```markdown chaff-before
Subject: Customer workshop on 4 December: please register

Hi all,

We are holding a half-day workshop for our key customers on 4 December, at the Riverside office.
Please register by the date below so that we can book the room and the lunch.

Registration deadline: 20 November

- Place: Riverside office, room 3
- Time: 9:30 to 13:00, lunch included
- Registration deadline: 22 November

Thanks,
Priya
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email workshop-invite.md

workshop-invite.md   business/email · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    22 November

  ⚠  One item given two different values

     "Registration deadline" is 22 November here, but 20 November earlier in the same section
     When one section says "Deadline: May 3" and later "Deadline: May 5", the reader cannot tell which to trust. It happens when a date or a price is changed in one place and not in the other. Values written as "Item: value" or "The item is value", and table cells, are read; the same item name (case and width aside) with two different values in the same unit within one section is pointed out (measured quantities such as 410 g and 450 g included, and lengths of time such as 3 months and 6 months; years are compared in months, so 1 year and 12 months agree, while 1 month and 30 days are not compared). Ages are values too ("aged 40", "up to the age of 70", "aged 20 to 70"): a range and an upper limit are compared by their upper ends, and one age is not compared with a range. A retention period is compared across the whole document: "we keep personal information for 1 year" and "we delete personal information 3 years after the account is closed" give one thing (the same noun phrase) two lengths. An item that has one value for the whole document (a name in the fact-document-term lexicon, such as probation period) is compared across sections too: a table cell "Probation | 3 months" and a sentence in another section "The probation period is 6 months" disagree. The value in a section headed by the item's name ("2. Warranty period") counts like a table cell, and a sentence with the item as its subject is read even with the point it counts from ("The warranty period for the product is 24 months from the date of purchase"). Values written as "Item: value" or "The item is value", and table cells, are read; the same item name (case and width aside) with two different values in the same unit within one section is pointed out (measured quantities such as 410 g and 450 g included, and lengths of time such as 3 months and 6 months; 1 year and 12 months are not compared). A sentence whose subject is exactly a table row's heading ("Hospital cash is paid at $150 for each day") has its amount compared with that row's amount in the same section ($100 a day). A count a sentence states as the whole ("Your order is for 4 tickets in total") is compared with the table column that counts it (Tickets): the count in the total row, or else the sum of the rows (a row that counts the same tickets again, such as a ticketing fee, is not added).

     → Check which value is right and correct the other. If they are values of different things (another session, another group), say so in the item name ("Second session deadline").

     Relax this rule:  npx chaffjs relax fact-conflict


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Customer workshop on 4 December: please register

Hi all,

We are holding a half-day workshop for our key customers on 4 December, at the Riverside office.
Please register by the date below so that we can book the room and the lunch.

Registration deadline: 20 November

- Place: Riverside office, room 3
- Time: 9:30 to 13:00, lunch included
- Registration deadline: 20 November

Thanks,
Priya
```

## How it was fixed

The email gives the registration deadline twice, as 20 November and as 22 November.
The caterer moved the deadline for numbers forward, and only the line at the top was changed.
Readers who go by the list register on the 21st and find themselves too late; the organiser cannot tell how many will come.

The fix gives both lines the date the caterer needs.
chaff does not decide which is right; the writer checks.
If the two dates belong to different things (a first and a second round), name them apart ("Late registration deadline").

## Settings

The rule is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  fact-conflict: relaxed
```

Values written as "Item: value", "The item is value" and table cells are read, and the same item with two values in one section is reported.
Values under different headings, or under a line such as "Session 2:", are read as values of different things.
A value with a condition ("$300 per person"), values in different units, and an item with three or more values (a list) are left alone.
The same item given different values in two files is the job of `cross-doc-fact-conflict`.

```text chaff-explain
$ npx chaffjs explain fact-conflict --genre business/email

  One item given two different values   (fact-conflict)

  When one section says "Deadline: May 3" and later "Deadline: May 5", the reader cannot tell which to trust. It happens when a date or a price is changed in one place and not in the other. Values written as "Item: value" or "The item is value", and table cells, are read; the same item name (case and width aside) with two different values in the same unit within one section is pointed out (measured quantities such as 410 g and 450 g included, and lengths of time such as 3 months and 6 months; years are compared in months, so 1 year and 12 months agree, while 1 month and 30 days are not compared). Ages are values too ("aged 40", "up to the age of 70", "aged 20 to 70"): a range and an upper limit are compared by their upper ends, and one age is not compared with a range. A retention period is compared across the whole document: "we keep personal information for 1 year" and "we delete personal information 3 years after the account is closed" give one thing (the same noun phrase) two lengths. An item that has one value for the whole document (a name in the fact-document-term lexicon, such as probation period) is compared across sections too: a table cell "Probation | 3 months" and a sentence in another section "The probation period is 6 months" disagree. The value in a section headed by the item's name ("2. Warranty period") counts like a table cell, and a sentence with the item as its subject is read even with the point it counts from ("The warranty period for the product is 24 months from the date of purchase"). Values written as "Item: value" or "The item is value", and table cells, are read; the same item name (case and width aside) with two different values in the same unit within one section is pointed out (measured quantities such as 410 g and 450 g included, and lengths of time such as 3 months and 6 months; 1 year and 12 months are not compared). A sentence whose subject is exactly a table row's heading ("Hospital cash is paid at $150 for each day") has its amount compared with that row's amount in the same section ($100 a day). A count a sentence states as the whole ("Your order is for 4 tickets in total") is compared with the table column that counts it (Tickets): the count in the total row, or else the sum of the rows (a row that counts the same tickets again, such as a ticketing fee, is not added).

  How to fix: Check which value is right and correct the other. If they are values of different things (another session, another group), say so in the item name ("Second session deadline").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax fact-conflict --why "reason"
```

[All samples](README.md)
