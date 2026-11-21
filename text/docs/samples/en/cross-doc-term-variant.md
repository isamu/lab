<!-- chaff-sample
rule: cross-doc-term-variant
genre: docs/manual
file: orders.md
-->

# A word spelled differently in different files (`cross-doc-term-variant`)

**Where it helps:** help sites, staff handbooks, manuals split into pages. Each page can be consistent on its own while the pages disagree with each other.

## Original

```markdown chaff-before
# Taking an order by phone

Open the order screen and search for the customer by name.
Read the order back to the customer before you save it.

The customer gets a confirmation e-mail within a few minutes.
If the e-mail does not arrive, check the address on the customer's record.
```

```markdown chaff-file returns.md
# Taking back a return

Find the order from the number on the packing slip.
Tick the items that came back and choose a reason.

The customer gets an email when the refund is made.
The email gives the amount and the card it went to.
```

```markdown chaff-file accounts.md
# Opening a customer account

Ask for the customer's name, address and email.
We send a link by email, and the account opens when they click it.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual orders.md returns.md accounts.md

orders.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    The customer gets a confirmation e-mail within a few minutes.

  ·  A word spelled differently in different files

     "e-mail" here, but "email" in 2 other files checked with it (as in accounts.md)
     In a manual or a bundle of documents, each file can be consistent on its own while the files disagree with each other: one page writes "e-mail", the others "email". It happens when different people write at different times. A reader wonders whether they are different things, and a site search misses one. The files given together are compared, and a word written one way in some files and another way in the rest is pointed out. Three kinds of spelling are compared: the final ー of a katakana word (サーバ / サーバー), British and American spellings (colour / color), and a Latin word with and without a hyphen (e-mail / email). chaff does not pick a side; it points at the way fewer files use.

     → Change it to "email". If the team has decided which way, list the pair under prefer in chaff.yaml, and every file is checked against it.

     Relax this rule:  npx chaffjs relax cross-doc-term-variant


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Taking an order by phone

Open the order screen and search for the customer by name.
Read the order back to the customer before you save it.

The customer gets a confirmation email within a few minutes.
If the email does not arrive, check the address on the customer's record.
```

## How it was fixed

The three pages of the staff guide were written at different times.
Two write "email"; the page on phone orders, the oldest, writes "e-mail".
Each page is consistent, so a check of one page at a time finds nothing, but a search of the guide for "email" misses the phone order page.

The fix writes "email" on that page too.
chaff compares the files given together and points at the spelling fewer files use. It compares three kinds of spelling: a word with and without a hyphen, British and American spellings, and (in Japanese) the long vowel at the end of a katakana word.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
Give chaff all the files at once (`npx chaffjs docs/*.md`); it only compares files checked together.

If the team has decided the spelling, list it under `prefer` (the form to avoid, then the form to use), and every file is checked against it, even one checked alone:

```yaml chaff-settings
prefer:
  e-mail: email
```

To stop checking:

```yaml chaff-settings
rules:
  cross-doc-term-variant: off
```

```text chaff-explain
$ npx chaffjs explain cross-doc-term-variant --genre docs/manual

  A word spelled differently in different files   (cross-doc-term-variant)

  In a manual or a bundle of documents, each file can be consistent on its own while the files disagree with each other: one page writes "e-mail", the others "email". It happens when different people write at different times. A reader wonders whether they are different things, and a site search misses one. The files given together are compared, and a word written one way in some files and another way in the rest is pointed out. Three kinds of spelling are compared: the final ー of a katakana word (サーバ / サーバー), British and American spellings (colour / color), and a Latin word with and without a hyphen (e-mail / email). chaff does not pick a side; it points at the way fewer files use.

  How to fix: Change it to "the other files' spelling". If the team has decided which way, list the pair under prefer in chaff.yaml, and every file is checked against it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cross-doc-term-variant --why "reason"
```

[All samples](README.md)
