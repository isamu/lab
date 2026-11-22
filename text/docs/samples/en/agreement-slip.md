<!-- chaff-sample
rule: agreement-slip
genre: business/email
file: booking-email.md
-->

# Words that do not agree (`agreement-slip`)

**Where it helps:** emails, release notes, announcements. Any text that was rewritten in a hurry, by a person or by an AI asked to change one word.

## Original

```markdown chaff-before
Subject: Booking app update on Thursday

Hi everyone,

These new version of the room booking app goes live on Thursday morning.
It brings a significant changes in repeat bookings: a weekly booking now ends after twelve weeks.
Renew it if you need the room for longer.

Your bookings stay as they are, and you will get a reminder a week before one ends.

Thanks,
Priya
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email booking-email.md

booking-email.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    These new version of the room booking app goes live on Thursday morning.

  ⚠  Words that do not agree

     "These new version" mixes singular and plural
     A determiner and a noun that differ in number ("a significant changes", "these new version"), a possessive where the subject belongs ("Your can check"), or two determiners in a row ("the some roads"), is left over from an edit that fixed one word and not the other. The reader stumbles, and the document looks rushed. Only forms with one reading are counted; nouns spelled alike in both numbers ("series", "data"), a word right after "this" or "these" (which can stand alone), and nouns that modify another noun ("a sales team") are not.

     → Make the determiner and the noun agree ("a significant change" or "significant changes"). For a possessive, write the subject you meant ("Your can" becomes "You can", "their will" becomes "they will"). For two determiners in a row, drop one ("the some roads" becomes "some roads", or "that some roads" if that was meant).

     Relax this rule:  npx chaffjs relax agreement-slip


─── line 6 ───────────────────────────────────────────────────

    It brings a significant changes in repeat bookings: a weekly booking now ends after twelve weeks.

  ⚠  Words that do not agree

     "a significant changes" mixes singular and plural
     A determiner and a noun that differ in number ("a significant changes", "these new version"), a possessive where the subject belongs ("Your can check"), or two determiners in a row ("the some roads"), is left over from an edit that fixed one word and not the other. The reader stumbles, and the document looks rushed. Only forms with one reading are counted; nouns spelled alike in both numbers ("series", "data"), a word right after "this" or "these" (which can stand alone), and nouns that modify another noun ("a sales team") are not.

     → Make the determiner and the noun agree ("a significant change" or "significant changes"). For a possessive, write the subject you meant ("Your can" becomes "You can", "their will" becomes "they will"). For two determiners in a row, drop one ("the some roads" becomes "some roads", or "that some roads" if that was meant).

     Relax this rule:  npx chaffjs relax agreement-slip


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Booking app update on Thursday

Hi everyone,

The new version of the room booking app goes live on Thursday morning.
It brings a significant change in repeat bookings: a weekly booking now ends after twelve weeks.
Renew it if you need the room for longer.

Your bookings stay as they are, and you will get a reminder a week before one ends.

Thanks,
Priya
```

## How it was fixed

Both slips are what an edit leaves behind.
The draft once said "These new features" and "significant changes"; one word was changed and its partner was not.
A reader trips on "These new version", and the note about repeat bookings, the part people need to act on, starts to look careless.

The fix makes each pair agree: "The new version" and "a significant change".
Only those words changed.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

chaff counts only forms with one reading.
A noun spelled alike in both numbers ("series", "data"), a word right after "this" or "these", and a noun that modifies another noun ("a sales team") are not reported.

```yaml chaff-settings
rules:
  agreement-slip: relaxed
```

The rule does not run on fiction, poetry, plays or speech transcripts, where the words belong to a voice.

```text chaff-explain
$ npx chaffjs explain agreement-slip --genre business/email

  Words that do not agree   (agreement-slip)

  A determiner and a noun that differ in number ("a significant changes", "these new version"), a possessive where the subject belongs ("Your can check"), or two determiners in a row ("the some roads"), is left over from an edit that fixed one word and not the other. The reader stumbles, and the document looks rushed. Only forms with one reading are counted; nouns spelled alike in both numbers ("series", "data"), a word right after "this" or "these" (which can stand alone), and nouns that modify another noun ("a sales team") are not.

  How to fix: Make the determiner and the noun agree ("a significant change" or "significant changes"). For a possessive, write the subject you meant ("Your can" becomes "You can", "their will" becomes "they will"). For two determiners in a row, drop one ("the some roads" becomes "some roads", or "that some roads" if that was meant).

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax agreement-slip --why "reason"
```

[All samples](README.md)
