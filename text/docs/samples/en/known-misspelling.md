<!-- chaff-sample
rule: known-misspelling
genre: business/email
file: order-shipped.md
-->

# Common misspelling (`known-misspelling`)

**Where it helps:** customer emails, letters, notices. The words everyone knows and many people misspell.

## Original

```markdown chaff-before
Subject: Your order has shipped

Dear customer,

Your order left our warehouse this morning. You should recieve it within three working days.

The cushions and the throw were packed seperately, so they may arrive on different days.
Each parcel has its own tracking number in the email we sent with your receipt.

Best wishes,
The Linen Room
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email order-shipped.md

order-shipped.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    You should recieve it within three working days.

  ⚠  Common misspelling

     "recieve" is a misspelling of "receive"
     Some words are easy to misspell by ear or by habit ("definately", "seperate", "recieve"). A reader who notices one starts to doubt the rest of the document. The pairs of misspelling and spelling are in each language's lexicon, and chaff reports only the forms listed there. A form inside a longer word is not reported ("teh" in "Tehran").

     → Correct the spelling. If the word is a name spelled that way on purpose, add it to names in chaff.yaml.

     Relax this rule:  npx chaffjs relax known-misspelling


─── line 7 ───────────────────────────────────────────────────

    The cushions and the throw were packed seperately, so they may arrive on different days.

  ⚠  Common misspelling

     "seperately" is a misspelling of "separately"
     Some words are easy to misspell by ear or by habit ("definately", "seperate", "recieve"). A reader who notices one starts to doubt the rest of the document. The pairs of misspelling and spelling are in each language's lexicon, and chaff reports only the forms listed there. A form inside a longer word is not reported ("teh" in "Tehran").

     → Correct the spelling. If the word is a name spelled that way on purpose, add it to names in chaff.yaml.

     Relax this rule:  npx chaffjs relax known-misspelling


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Your order has shipped

Dear customer,

Your order left our warehouse this morning. You should receive it within three working days.

The cushions and the throw were packed separately, so they may arrive on different days.
Each parcel has its own tracking number in the email we sent with your receipt.

Best wishes,
The Linen Room
```

## How it was fixed

"Recieve" and "seperately" are two of the most common misspellings in English.
In an email to a customer, they make the shop look careless at exactly the moment it is asking to be trusted with a delivery.

The fix corrects the two words and nothing around them.
chaff reports only the misspellings in its lexicon, each with the right spelling, so the message says what to type.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

Spellings that are both in use (British and American, "judgement" and "judgment") are not misspellings; they are left to the consistency rules.

If a name is spelled like a misspelling on purpose, list it under `names` and chaff leaves it alone:

```yaml chaff-settings
names:
  - Seperate Studio
```

```yaml chaff-settings
rules:
  known-misspelling: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain known-misspelling --genre business/email

  Common misspelling   (known-misspelling)

  Some words are easy to misspell by ear or by habit ("definately", "seperate", "recieve"). A reader who notices one starts to doubt the rest of the document. The pairs of misspelling and spelling are in each language's lexicon, and chaff reports only the forms listed there. A form inside a longer word is not reported ("teh" in "Tehran").

  How to fix: Correct the spelling. If the word is a name spelled that way on purpose, add it to names in chaff.yaml.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax known-misspelling --why "reason"
```

[All samples](README.md)
