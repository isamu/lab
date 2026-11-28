<!-- chaff-sample
rule: calendar-name-case
genre: business/meeting-notes
file: committee-minutes.md
-->

# Weekday or month in lower case (`calendar-name-case`)

**Where it helps:** minutes, notes typed during a meeting, messages pasted from a chat into a document.

## Original

```markdown chaff-before
# Volunteer committee, minutes

Present: the chair, the treasurer and four members.

## Summer fair

The fair is confirmed for saturday 14 June on the school field.
Stalls will be set up from 8 am, and the gates open at 10.

## Actions

- The treasurer will bring the cash boxes to the hall on friday.
- The chair will send the stall list to members by 30 May.

Next meeting: tuesday 1 july, 7 pm, in the library.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes committee-minutes.md

committee-minutes.md   business/meeting-notes · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    ir is confirmed for saturday 14 June on the scho

  ⚠  Weekday or month in lower case

     Write "saturday" as "Saturday"
     English always capitalises the names of the days and months (Monday, January). "On monday" reads as typed in a hurry or pasted from a chat, and splits a search from the capitalised form. It is a rule of English spelling, not a matter of style.

     → Capitalise the first letter.

     Relax this rule:  npx chaffjs relax calendar-name-case


─── line 12 ──────────────────────────────────────────────────

    oxes to the hall on friday. - The chair will s

  ⚠  Weekday or month in lower case

     Write "friday" as "Friday"
     English always capitalises the names of the days and months (Monday, January). "On monday" reads as typed in a hurry or pasted from a chat, and splits a search from the capitalised form. It is a rule of English spelling, not a matter of style.

     → Capitalise the first letter.

     Relax this rule:  npx chaffjs relax calendar-name-case


─── line 15 ──────────────────────────────────────────────────

    meeting: tuesday 1 july, 7 pm, in the libra

  ⚠  Weekday or month in lower case

     Write "july" as "July"
     English always capitalises the names of the days and months (Monday, January). "On monday" reads as typed in a hurry or pasted from a chat, and splits a search from the capitalised form. It is a rule of English spelling, not a matter of style.

     → Capitalise the first letter.

     Relax this rule:  npx chaffjs relax calendar-name-case


────────────────────────────────────────────────────────────

  3 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Volunteer committee, minutes

Present: the chair, the treasurer and four members.

## Summer fair

The fair is confirmed for Saturday 14 June on the school field.
Stalls will be set up from 8 am, and the gates open at 10.

## Actions

- The treasurer will bring the cash boxes to the hall on Friday.
- The chair will send the stall list to members by 30 May.

Next meeting: Tuesday 1 July, 7 pm, in the library.
```

## How it was fixed

Minutes are typed fast, while people are talking, and day and month names come out in lower case.
In English that is not a style: "Saturday" and "July" are names and always take a capital.
Lower case makes the minutes look like a chat log, and someone searching the document for "July" may miss the date of the next meeting.

The fix capitalises the three names.
"30 May" was already right, and chaff does not look at "may", "march" or "august" in lower case at all, because they are ordinary words too.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

Code, paths and tags ("monday.md", "#friday"), setting values ("day: monday") and abbreviations ("mon", "jan") are not read.

```yaml chaff-settings
rules:
  calendar-name-case: relaxed
```

The rule runs in every genre: it is a rule of English spelling, not a choice of the writer's.

```text chaff-explain
$ npx chaffjs explain calendar-name-case --genre business/meeting-notes

  Weekday or month in lower case   (calendar-name-case)

  English always capitalises the names of the days and months (Monday, January). "On monday" reads as typed in a hurry or pasted from a chat, and splits a search from the capitalised form. It is a rule of English spelling, not a matter of style.

  How to fix: Capitalise the first letter.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax calendar-name-case --why "reason"
```

[All samples](README.md)
