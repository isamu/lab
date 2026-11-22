<!-- chaff-sample
rule: contraction-consistency
genre: business/email
file: email.md
-->

# Contraction use is inconsistent (`contraction-consistency`)

**Where it helps:** customer emails, help pages, newsletters. Any text where a friendly voice is part of the message.

## Original

```markdown chaff-before
Subject: Your new account at Fern Street Books

Hi Sam,

Thanks for opening an account with us. Here is what happens next.

Your first order ships free, and you don't need a code: the discount is taken off at checkout.
If a book you want isn't in stock, we'll order it in and email you when it arrives.
We don't keep your card details after the payment goes through.

If something arrives damaged, do not post it back to us. Send a photo by reply, and we'll send a new copy the same day.

Best wishes,
The team at Fern Street Books
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    If something arrives damaged, do not post it back to us.

  ·  Contraction use is inconsistent

     "do not" is written "don't" elsewhere in the document
     Whether to use contractions is a choice of register, and neither is wrong. Mixed within one document, the reader re-measures the distance sentence by sentence.

     → Write the same word the way the document mostly writes it.

     Relax this rule:  npx chaffjs relax contraction-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Your new account at Fern Street Books

Hi Sam,

Thanks for opening an account with us. Here is what happens next.

Your first order ships free, and you don't need a code: the discount is taken off at checkout.
If a book you want isn't in stock, we'll order it in and email you when it arrives.
We don't keep your card details after the payment goes through.

If something arrives damaged, don't post it back to us. Send a photo by reply, and we'll send a new copy the same day.

Best wishes,
The team at Fern Street Books
```

## How it was fixed

The email speaks in an easy voice: "don't", "isn't" and "we'll" all through.
Then one sentence switches to "do not", and the reader feels the tone stiffen, as if a rule from the terms and conditions had been pasted in.
The customer may wonder whether they did something wrong.

The fix writes "don't" there too, so the whole email keeps one voice.
chaff compares only the two forms of the same word: "don't" with "do not".
An email that always writes "do not" and also says "we'll" is consistent and is not reported.

## Settings

The rule looks for the rarer form of a word. At `normal`, it is reported when it appears twice or fewer; `strict` allows up to four, and `relaxed` only one. Above that, chaff reads it as a deliberate choice, not a slip.
A full form in a warning ("Warning: do not unplug the reader") is chosen for stress and is never pointed at.

If your documents mix the two on purpose, turn the rule off:

```yaml chaff-settings
rules:
  contraction-consistency: off
```

It is off for literature and for transcripts, where the register belongs to the author or the speaker.

```text chaff-explain
$ npx chaffjs explain contraction-consistency --genre business/email

  Contraction use is inconsistent   (contraction-consistency)

  Whether to use contractions is a choice of register, and neither is wrong. Mixed within one document, the reader re-measures the distance sentence by sentence.

  How to fix: Write the same word the way the document mostly writes it.

  Levels:
    strict   reported when the minority form of a word appears 4 times or fewer
  → normal   reported when the minority form of a word appears 2 times or fewer
    relaxed  reported when the minority form of a word appears 1 time or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax contraction-consistency --why "reason"
```

[All samples](README.md)
