<!-- chaff-sample
rule: cross-doc-fact-conflict
genre: docs/faq
file: faq.md
-->

# One item given different values in different files (`cross-doc-fact-conflict`)

**Where it helps:** help sites, member handbooks, product pages split into files. Each page can be right on its own while two pages disagree.

## Original

```markdown chaff-before
# Questions about membership

## How do I join?

Sign up at the front desk or on our website. Bring a photo ID for your card.

Joining fee: £25

## Can I freeze my membership?

Yes, for up to three months a year. Ask at the front desk at least a week before.
```

```markdown chaff-file membership.md
# Membership

Our membership gives you the gym, the pool and every class on the timetable.

Joining fee: £20

Monthly fee: £38

Cancel at any time with one month's notice.
```

```markdown chaff-file join-online.md
# Join online

Choose a start date and pay by card. Your card is ready at the front desk on your first visit.

Joining fee: £20
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/faq faq.md membership.md join-online.md

faq.md   docs/faq · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    £25

  ⚠  One item given different values in different files

     "Joining fee" is £25 here, but £20 in 2 other files checked with it (as in join-online.md)
     A manual or a bundle of documents repeats the same items, such as a fee, a version, a deadline or a contact address, on page after page. When a value changes and one page is missed, the pages disagree and the reader cannot tell which to trust. Across the files given together, values written as "Item: value" or "The item is value", and table cells, are read; a file that gives the same item name (case and width aside) a different value in the same unit is pointed out. Email addresses and versions of three parts or more (2.4.1, v3) are read as values too. chaff does not decide which is right; it points at the value fewer files give. When as many files give one value as the other, neither is fewer, and the files of both values are pointed out.

     → Check which value is right and correct the other. If they are values of different things (another plan, another release), say so in the item name ("Pro plan monthly fee").

     Relax this rule:  npx chaffjs relax cross-doc-fact-conflict


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Questions about membership

## How do I join?

Sign up at the front desk or on our website. Bring a photo ID for your card.

Joining fee: £20

## Can I freeze my membership?

Yes, for up to three months a year. Ask at the front desk at least a week before.
```

## How it was fixed

The membership page and the online sign-up page give the joining fee as £20, and the questions page as £25.
The fee was lowered in the spring, and the page that is read less often kept the old price.
A new member who reads the questions page as well does not know what they will pay, and the front desk has to explain the difference.

The fix gives the questions page the current fee.
chaff does not decide which file is right; it points at the value fewer files give, and the writer checks.
If the two values really belong to different things (a student rate, a promotion), name the thing in the item ("Student joining fee").

## Settings

The rule compares the files given in one run, so it runs when chaff is given two or more files, or a folder:

```text
npx chaffjs faq.md membership.md join-online.md
```

It is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  cross-doc-fact-conflict: relaxed
```

Values written as "Item: value", "The item is value" and table cells are read.
A file that gives an item two values itself (a fee per plan) is not counted, and an item whose values split three or more ways is read as a list and left alone.
Two values in one file are the job of `fact-conflict`.

```text chaff-explain
$ npx chaffjs explain cross-doc-fact-conflict --genre docs/faq

  One item given different values in different files   (cross-doc-fact-conflict)

  A manual or a bundle of documents repeats the same items, such as a fee, a version, a deadline or a contact address, on page after page. When a value changes and one page is missed, the pages disagree and the reader cannot tell which to trust. Across the files given together, values written as "Item: value" or "The item is value", and table cells, are read; a file that gives the same item name (case and width aside) a different value in the same unit is pointed out. Email addresses and versions of three parts or more (2.4.1, v3) are read as values too. chaff does not decide which is right; it points at the value fewer files give. When as many files give one value as the other, neither is fewer, and the files of both values are pointed out.

  How to fix: Check which value is right and correct the other. If they are values of different things (another plan, another release), say so in the item name ("Pro plan monthly fee").

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cross-doc-fact-conflict --why "reason"
```

[All samples](README.md)
