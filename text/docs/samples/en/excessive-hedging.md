<!-- chaff-sample
rule: excessive-hedging
genre: business/email
file: delivery-email.md
-->

# Too much hedging (`excessive-hedging`)

**Where it helps:** status emails, reports, proposals. Anywhere the reader has to plan around what you say.

## Original

```markdown chaff-before
Subject: Delivery of the shelving units

Hi Morgan,

The shelving units for your Leeds shop are in our warehouse.
The fixing brackets have not arrived from the supplier yet.
It may be that the delivery could possibly slip to the following week.

I will write again as soon as the brackets are here.

Best regards,
Sam
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email delivery-email.md

delivery-email.md   business/email · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    It may be that the delivery could possibly slip to the following week.

  ⚠  Too much hedging

     This sentence stacks 3 hedges ("It may be, could, possibly")
     The more the text avoids claiming, the less the reader can tell what was decided. One hedge is caution; many mean nobody is accountable. chaff looks two ways. A sentence that stacks hedges ("may possibly", "it could perhaps be argued") is reported on its own, even in a short document. Too many hedges across the whole document is measured only on longer documents. When counting hedges stacked in a sentence, a hedge inside a quotation is the speaker's, not the writer's, and is left out.

     → Commit where you can. Where you cannot, say what you would need to know. Where hedges are stacked, keep one or drop them all and commit.

     Relax this rule:  npx chaffjs relax excessive-hedging


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Delivery of the shelving units

Hi Morgan,

The shelving units for your Leeds shop are in our warehouse.
The fixing brackets have not arrived from the supplier yet.
The supplier now expects them on Thursday, so the delivery may move to the following week.

I will write again on Thursday afternoon, when we know.

Best regards,
Sam
```

## How it was fixed

"It may be that the delivery could possibly slip" stacks three hedges in one sentence.
Morgan has a shop to open and cannot plan around it: is the delivery late or not, and when will Sam know?

The fix keeps one hedge, because the delay is not certain yet, and says what it depends on: the brackets, expected on Thursday.
It also gives the next update a day.
The doubt is still there, but now it is a doubt Morgan can plan around.

## Settings

The rule looks two ways.
A sentence that stacks hedges ("may possibly", "it could perhaps be argued") is reported on its own, even in a short email, as here.
Across a longer document, it also counts hedges per 1000 words, and reports more than three at `strict`, six at `normal`, twelve at `relaxed`.

```yaml chaff-settings
rules:
  excessive-hedging: relaxed
```

It does not run on legal text, academic papers, literature or speech transcripts, where hedging is part of the form.
A single hedge is caution and is never reported, nor is a hedge inside a quotation.

```text chaff-explain
$ npx chaffjs explain excessive-hedging --genre business/email

  Too much hedging   (excessive-hedging)

  The more the text avoids claiming, the less the reader can tell what was decided. One hedge is caution; many mean nobody is accountable. chaff looks two ways. A sentence that stacks hedges ("may possibly", "it could perhaps be argued") is reported on its own, even in a short document. Too many hedges across the whole document is measured only on longer documents. When counting hedges stacked in a sentence, a hedge inside a quotation is the speaker's, not the writer's, and is left out.

  How to fix: Commit where you can. Where you cannot, say what you would need to know. Where hedges are stacked, keep one or drop them all and commit.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 3 hedges per 1000 words (hedges stacked in one sentence are reported whatever the length)
  → normal   up to 6 hedges per 1000 words (hedges stacked in one sentence are reported whatever the length)
    relaxed  up to 12 hedges per 1000 words (hedges stacked in one sentence are reported whatever the length)
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax excessive-hedging --why "reason"
```

[All samples](README.md)
