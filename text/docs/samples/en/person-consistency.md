<!-- chaff-sample
rule: person-consistency
genre: docs/manual
file: guide.md
-->

# The document names itself or its reader two ways (`person-consistency`)

**Where it helps:** guides, help pages, policies. Any text that speaks to its reader, especially one with paragraphs from an older or more formal document.

## Original

```markdown chaff-before
# Using the bike store

You can leave your bike in the store under the main building from 7 am to 9 pm.
Your staff card opens the door, so you do not need a key.

Lock your bike to one of the rails, even inside the store.
If you lose your card, you can ask reception to cancel it and print a new one.
You will find a pump and a basic toolkit by the door.

One should not leave a bike in the store overnight, as the cleaners need the floor clear.
If you see a bike that has not moved for weeks, tell reception.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual guide.md

guide.md   docs/manual · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    One should not leave a bike in the store overnight, as the cleaners need the floor clear.

  ·  The document names itself or its reader two ways

     "One should" here, where the document usually says "you" (1 of 11)
     Whether a Japanese document calls itself 私たち or 弊社 and its writer 私 or 筆者, and whether an English document addresses its reader as "you" or as "one", is a choice of voice, and chaff does not pick one. Mixed in one document, the reader wonders whether the speaker changed or someone else is meant; it happens most where text was stitched together or another writer added a paragraph. chaff takes the form the document uses most as its habit and points at the other. Quotations, quoted blocks and code are not counted. English "we" and "I" are not compared, since in most documents they name two parties (the organisation and the speaker).

     → If the same party is meant, use the form the rest of the document uses. If another party is meant (the company and the writer), make the difference clear to the reader.

     Relax this rule:  npx chaffjs relax person-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Using the bike store

You can leave your bike in the store under the main building from 7 am to 9 pm.
Your staff card opens the door, so you do not need a key.

Lock your bike to one of the rails, even inside the store.
If you lose your card, you can ask reception to cancel it and print a new one.
You will find a pump and a basic toolkit by the door.

Do not leave your bike in the store overnight, as the cleaners need the floor clear.
If you see a bike that has not moved for weeks, tell reception.
```

## How it was fixed

The guide talks to its reader as "you" throughout, and then one sentence says "one should not".
The voice changes from a colleague to a rule book, and the reader wonders whether the sentence is about them or about people in general.
It is usually a line kept from an older notice.

The fix says it to the reader directly, in the same voice as the rest.
chaff does not decide which voice is right; it takes the one the document uses most and points at the other.
"We" and "I" are not compared, since in most documents they name two parties.

## Settings

The other form is reported when it is a fifth of the places or fewer (20 percent at `normal`, 30 at `strict`, 10 at `relaxed`).
A document whose usual form appears fewer than three times is not read, and quotations and code are not counted.
Only "one" as the subject of a verb like "should" or "can" is counted, not "no one" or "the one".

To stop checking:

```yaml chaff-settings
rules:
  person-consistency: off
```

It is off for literature and for transcripts, where each speaker names themselves their own way.

```text chaff-explain
$ npx chaffjs explain person-consistency --genre docs/manual

  The document names itself or its reader two ways   (person-consistency)

  Whether a Japanese document calls itself 私たち or 弊社 and its writer 私 or 筆者, and whether an English document addresses its reader as "you" or as "one", is a choice of voice, and chaff does not pick one. Mixed in one document, the reader wonders whether the speaker changed or someone else is meant; it happens most where text was stitched together or another writer added a paragraph. chaff takes the form the document uses most as its habit and points at the other. Quotations, quoted blocks and code are not counted. English "we" and "I" are not compared, since in most documents they name two parties (the organisation and the speaker).

  How to fix: If the same party is meant, use the form the rest of the document uses. If another party is meant (the company and the writer), make the difference clear to the reader.

  Levels:
    strict   reported when the other form is 30 percent of the places or fewer
  → normal   reported when the other form is 20 percent of the places or fewer
    relaxed  reported when the other form is 10 percent of the places or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax person-consistency --why "reason"
```

[All samples](README.md)
