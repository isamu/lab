<!-- chaff-sample
rule: title-case-consistency
genre: docs/manual
file: guide.md
-->

# Heading capitalisation is inconsistent (`title-case-consistency`)

**Where it helps:** user guides, help pages, handbooks. Any document whose sections were written at different times or by different people.

## Original

```markdown chaff-before
# Room booking guide

## Finding a free room

Open the booking page and pick a day. Rooms that are free show in green.

## Booking a room

Click a green slot, give the meeting a title and press Book. You get an email with the details.

## Changing Or Cancelling A Booking

Open the booking from the email and press Change or Cancel. Cancel at least an hour before, so someone else can use the room.

## Rooms with screens

The Oak and Elm rooms have a screen and a camera for video calls.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual guide.md

guide.md   docs/manual · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    Changing Or Cancelling A Booking

  ·  Heading capitalisation is inconsistent

     This heading's capitalisation differs from the rest (1 in this document)
     Neither Title Case nor sentence case is wrong. Mixed within one document, the headings look like they change level. The document's title (the first heading, when no other heading is as shallow) is a name and is not compared; when the section headings split evenly, the title's style decides. A leading label (Section 3., b., Day 1:), the names of weekdays and months, the short conjunctions title case writes either way (if, nor), and the names the body itself capitalises mid-sentence, none of which tells the styles apart, count as evidence for neither.

     → Match the majority.

     Relax this rule:  npx chaffjs relax title-case-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Room booking guide

## Finding a free room

Open the booking page and pick a day. Rooms that are free show in green.

## Booking a room

Click a green slot, give the meeting a title and press Book. You get an email with the details.

## Changing or cancelling a booking

Open the booking from the email and press Change or Cancel. Cancel at least an hour before, so someone else can use the room.

## Rooms with screens

The Oak and Elm rooms have a screen and a camera for video calls.
```

## How it was fixed

Three section headings are in sentence case: only the first word has a capital.
The third one capitalises every word, so in the table of contents it looks like a heading of another kind or another level.
It is usually a section pasted in from another guide.

The fix writes it in sentence case like the others.
chaff does not decide which style is right. A guide whose headings are mostly in Title Case would have the sentence-case one pointed at instead.
The document's title, the first heading, is a name and is not compared.

## Settings

At `normal`, the rarer style is reported when it has two headings or fewer; `strict` allows three, `relaxed` one.
Above that, the guide mixes them on purpose.
Weekday and month names, and the names the body itself capitalises (here "Book", "Change" and "Cancel" are button names), count for neither style.

To stop checking:

```yaml chaff-settings
rules:
  title-case-consistency: off
```

```text chaff-explain
$ npx chaffjs explain title-case-consistency --genre docs/manual

  Heading capitalisation is inconsistent   (title-case-consistency)

  Neither Title Case nor sentence case is wrong. Mixed within one document, the headings look like they change level. The document's title (the first heading, when no other heading is as shallow) is a name and is not compared; when the section headings split evenly, the title's style decides. A leading label (Section 3., b., Day 1:), the names of weekdays and months, the short conjunctions title case writes either way (if, nor), and the names the body itself capitalises mid-sentence, none of which tells the styles apart, count as evidence for neither.

  How to fix: Match the majority.

  Levels:
    strict   reported when the minority style has 3 headings or fewer
  → normal   reported when the minority style has 2 headings or fewer
    relaxed  reported when the minority style has 1 heading or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax title-case-consistency --why "reason"
```

[All samples](README.md)
