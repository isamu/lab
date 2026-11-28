<!-- chaff-sample
rule: quote-style-consistency
genre: business/meeting-notes
file: notes.md
-->

# Straight and curly quotes mixed (`quote-style-consistency`)

**Where it helps:** meeting notes, reports, web pages. Any document put together from email, a word processor and a chat window.

## Original

```markdown chaff-before
# Website team, weekly notes

Present: Priya, Tom, Elena, Marcus.

Tom showed the new "Book a visit" page. It's live on the test site and the form sends to the shared inbox.
Priya asked whether the page can say "free parking" again, since the car park reopens next month.
Elena pasted the client’s feedback from their email: the new photos are “much better”, but the map is hard to read on a phone.

Actions: Tom fixes the map before Friday. Marcus checks the opening hours with the client.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes notes.md

notes.md   business/meeting-notes · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    Elena pasted the client’s feedback from their email: the new photos are “much better”, but the map is hard to read on a …

  ·  Straight and curly quotes mixed

     The quote mark ’ here, where the document usually writes ' (1 of 2)
     Straight quotes and apostrophes (" ') mixed with curly ones (“ ” ’) make a document look pasted together, and a search or replace finds only one kind. chaff does not pick a side; it points at the less common way in the document.

     → Match the form the rest of the document uses.

     Relax this rule:  npx chaffjs relax quote-style-consistency


─── line 7 ───────────────────────────────────────────────────

    Elena pasted the client’s feedback from their email: the new photos are “much better”, but the map is hard to read on a …

  ·  Straight and curly quotes mixed

     The quote mark “ here, where the document usually writes " (2 of 6)
     Straight quotes and apostrophes (" ') mixed with curly ones (“ ” ’) make a document look pasted together, and a search or replace finds only one kind. chaff does not pick a side; it points at the less common way in the document.

     → Match the form the rest of the document uses.

     Relax this rule:  npx chaffjs relax quote-style-consistency


─── line 7 ───────────────────────────────────────────────────

    Elena pasted the client’s feedback from their email: the new photos are “much better”, but the map is hard to read on a …

  ·  Straight and curly quotes mixed

     The quote mark ” here, where the document usually writes " (2 of 6)
     Straight quotes and apostrophes (" ') mixed with curly ones (“ ” ’) make a document look pasted together, and a search or replace finds only one kind. chaff does not pick a side; it points at the less common way in the document.

     → Match the form the rest of the document uses.

     Relax this rule:  npx chaffjs relax quote-style-consistency


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Website team, weekly notes

Present: Priya, Tom, Elena, Marcus.

Tom showed the new "Book a visit" page. It's live on the test site and the form sends to the shared inbox.
Priya asked whether the page can say "free parking" again, since the car park reopens next month.
Elena pasted the client's feedback from their email: the new photos are "much better", but the map is hard to read on a phone.

Actions: Tom fixes the map before Friday. Marcus checks the opening hours with the client.
```

## How it was fixed

The notes were typed with straight quotes, but one line came from the client's email, and the email program had turned its quotes and apostrophe curly.
On screen the difference is small. It still shows the seam where text was pasted in, and a search for `client's` with a straight apostrophe will miss "client’s".

The fix changes the pasted marks to straight ones, like the rest of the notes.
chaff does not prefer one kind. A document written mostly with curly quotes would have the straight ones pointed at.

## Settings

At `normal` and `strict`, the rarer form is reported from its first use; `relaxed` waits for three.
When the rarer form is common (five or more, and more than a fifth of all marks), chaff gives one note with both counts instead of one note per mark.
Double quotes and single quotes (apostrophes) are counted separately, and code is skipped.

To stop checking:

```yaml chaff-settings
rules:
  quote-style-consistency: off
```

It is off for documentation (`docs/*`), where code samples and screen text bring their own quotes.

```text chaff-explain
$ npx chaffjs explain quote-style-consistency --genre business/meeting-notes

  Straight and curly quotes mixed   (quote-style-consistency)

  Straight quotes and apostrophes (" ') mixed with curly ones (“ ” ’) make a document look pasted together, and a search or replace finds only one kind. chaff does not pick a side; it points at the less common way in the document.

  How to fix: Match the form the rest of the document uses.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once the less common way appears 1 time
  → normal   reported once the less common way appears 1 time
    relaxed  reported once the less common way appears 3 times
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax quote-style-consistency --why "reason"
```

[All samples](README.md)
