<!-- chaff-sample
rule: name-variant
genre: business/email
file: email.md
-->

# One name written two ways (`name-variant`)

**Where it helps:** emails, contracts, reports. Any document that names a company, a person or a product more than once.

## Original

```markdown chaff-before
Subject: Delivery partner from April

Dear Mr Osei,

Thank you for meeting us last week.
We have chosen Hartfield Logistics as our delivery partner for the north of the county from 1 April.

Hartfield Logistics will collect from our warehouse every weekday at 4 pm.
Their drivers already know the farm shops on our list, which should make the first weeks easier.
Please send your price list to Hartfeild Logistics directly, copying me in.

Kind regards,
Ruth Adams
Operations Manager
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    Hartfeild Logistics directly, copying me in.

  ·  One name written two ways

     "Hartfeild Logistics" is one letter away from "Hartfield Logistics", which the document uses more than once
     A person, company or product written as "GitHub" in one place and "Github" in another leaves the reader unsure whether they are the same. In a contract it blurs who the party is. The usual causes are a typo and a paragraph pasted from another document. chaff does not decide which form is right; it points at the one the document uses less.

     → Check the right form and use it throughout. If they really are different people or companies, leave them.

     Relax this rule:  npx chaffjs relax name-variant


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Delivery partner from April

Dear Mr Osei,

Thank you for meeting us last week.
We have chosen Hartfield Logistics as our delivery partner for the north of the county from 1 April.

Hartfield Logistics will collect from our warehouse every weekday at 4 pm.
Their drivers already know the farm shops on our list, which should make the first weeks easier.
Please send your price list to Hartfield Logistics directly, copying me in.

Kind regards,
Ruth Adams
Operations Manager
```

## How it was fixed

The company is "Hartfield" twice and "Hartfeild" once, two letters swapped.
A spell checker does not catch it, because it does not know the name.
The reader may not notice either, but a search of the mailbox for "Hartfield" misses this line, and in a contract the wrong spelling can blur who the party is.

The fix spells it the way the rest of the email does.
chaff does not know which spelling is right; it points at the one the document uses less. Check the company's own spelling before changing it.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
Only words read as proper nouns are compared, names in capitals only are left out, and names one letter apart are reported only when they are six letters or longer.
If two names really are different people or companies, leave them as they are.

To stop checking:

```yaml chaff-settings
rules:
  name-variant: off
```

```text chaff-explain
$ npx chaffjs explain name-variant --genre business/email

  One name written two ways   (name-variant)

  A person, company or product written as "GitHub" in one place and "Github" in another leaves the reader unsure whether they are the same. In a contract it blurs who the party is. The usual causes are a typo and a paragraph pasted from another document. chaff does not decide which form is right; it points at the one the document uses less.

  How to fix: Check the right form and use it throughout. If they really are different people or companies, leave them.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax name-variant --why "reason"
```

[All samples](README.md)
