<!-- chaff-sample
rule: outside-announced-list
genre: docs/faq
file: faq.md
-->

# A name outside the announced list (`outside-announced-list`)

**Where it helps:** product pages, FAQs, release notes. Any page that says once what is supported and mentions it again later.

## Original

```markdown chaff-before
# Timesheet app: common questions

## Which devices can I use?

The app is available on Windows and macOS. You sign in with your work account.

## Can I fill in my hours offline?

Yes. The app keeps your hours on the computer and sends them when you are back online.

## How do I install it?

Download it from the staff portal. It is also available on Linux, from the same page.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/faq faq.md

faq.md   docs/faq · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    Linux, from the same page.

  ⚠  A name outside the announced list

     "Linux" is not in the list given on line 5 (Windows, macOS)
     Listing "supported on Windows and macOS" and later writing "also runs on Linux" leaves the reader unable to tell which list is true. Usually a platform was added and the first list was not updated, or a sentence came from another product's page. chaff does not decide which is right; it points at the name the first list does not have. The words that announce a list are in each language's lexicon, and only words of the same group (platforms, languages) are compared.

     → If the list is out of date, add the name to it; if the later sentence is wrong, correct it.

     Relax this rule:  npx chaffjs relax outside-announced-list


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Timesheet app: common questions

## Which devices can I use?

The app is available on Windows, macOS and Linux. You sign in with your work account.

## Can I fill in my hours offline?

Yes. The app keeps your hours on the computer and sends them when you are back online.

## How do I install it?

Download it from the staff portal.
```

## How it was fixed

The first answer says the app runs on Windows and macOS.
The last answer says it runs on Linux too.
A reader who only reads the first answer thinks Linux is not supported, and one who reads both cannot tell which answer is out of date.
Usually a platform was added and only one answer was updated.

The fix adds Linux to the list in the first answer, where people look for it, and leaves the install answer without a second list to keep in step.
If Linux were not supported after all, the fix would be the other way: remove it from the last answer.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`.
Only names next to a listing word ("available on", "supported on") are read, and only names of the same group (platforms with platforms, languages with languages) are compared.

To make it a note:

```yaml chaff-settings
rules:
  outside-announced-list: relaxed
```

```text chaff-explain
$ npx chaffjs explain outside-announced-list --genre docs/faq

  A name outside the announced list   (outside-announced-list)

  Listing "supported on Windows and macOS" and later writing "also runs on Linux" leaves the reader unable to tell which list is true. Usually a platform was added and the first list was not updated, or a sentence came from another product's page. chaff does not decide which is right; it points at the name the first list does not have. The words that announce a list are in each language's lexicon, and only words of the same group (platforms, languages) are compared.

  How to fix: If the list is out of date, add the name to it; if the later sentence is wrong, correct it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax outside-announced-list --why "reason"
```

[All samples](README.md)
