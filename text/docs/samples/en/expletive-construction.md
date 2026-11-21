<!-- chaff-sample
rule: expletive-construction
genre: business/meeting-notes
file: minutes.md
-->

# Expletive construction (`expletive-construction`)

**Where it helps:** meeting notes, action lists, status reports. Documents whose job is to say who does what.

## Original

```markdown chaff-before
# Facilities meeting, 12 March

Present: Ana (facilities), Tom (IT), Grace (finance), Leo (office manager)

## Heating on the second floor

There were six complaints about the cold on the second floor in February.
It was agreed that the radiators should be checked before the end of the month.
There is a need to get a quote for new thermostats as well.

## Visitor parking

There were two days last week when visitors could not find a space.
It is likely that the spaces are being used by staff.
Leo will put up signs by Friday.

## Next meeting

9 April, same room.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes minutes.md

minutes.md   business/meeting-notes · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    There were six complaints about the cold on the second floor in February.

  ·  Expletive construction

     "There is ..." appears 5 times (limit 3)
     "There is" and "it is ... that" push the subject to the back and drop who does what.

     → Put the subject first. "There is a need to review" becomes "the board must review".

     Relax this rule:  npx chaffjs relax expletive-construction


─── line 8 ───────────────────────────────────────────────────

    It was agreed that the radiators should be checked before the end of the month.

  ·  Expletive construction

     "It is ..." appears 5 times (limit 3)
     "There is" and "it is ... that" push the subject to the back and drop who does what.

     → Put the subject first. "There is a need to review" becomes "the board must review".

     Relax this rule:  npx chaffjs relax expletive-construction


─── line 9 ───────────────────────────────────────────────────

    There is a need to get a quote for new thermostats as well.

  ·  Expletive construction

     "There is ..." appears 5 times (limit 3)
     "There is" and "it is ... that" push the subject to the back and drop who does what.

     → Put the subject first. "There is a need to review" becomes "the board must review".

     Relax this rule:  npx chaffjs relax expletive-construction


─── line 13 ──────────────────────────────────────────────────

    There were two days last week when visitors could not find a space.

  ·  Expletive construction

     "There is ..." appears 5 times (limit 3)
     "There is" and "it is ... that" push the subject to the back and drop who does what.

     → Put the subject first. "There is a need to review" becomes "the board must review".

     Relax this rule:  npx chaffjs relax expletive-construction


─── line 14 ──────────────────────────────────────────────────

    It is likely that the spaces are being used by staff.

  ·  Expletive construction

     "It is ..." appears 5 times (limit 3)
     "There is" and "it is ... that" push the subject to the back and drop who does what.

     → Put the subject first. "There is a need to review" becomes "the board must review".

     Relax this rule:  npx chaffjs relax expletive-construction


────────────────────────────────────────────────────────────

  5 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Facilities meeting, 12 March

Present: Ana (facilities), Tom (IT), Grace (finance), Leo (office manager)

## Heating on the second floor

Staff on the second floor complained six times about the cold in February.
Ana will have the radiators checked before the end of the month.
Grace will get a quote for new thermostats.

## Visitor parking

On two days last week, visitors could not find a space.
Leo thinks staff are using the spaces.
Leo will put up signs by Friday.

## Next meeting

9 April, same room.
```

## How it was fixed

Minutes are read a week later by someone who wants to know what they have to do.
"It was agreed that the radiators should be checked" and "There is a need to get a quote" record the decisions but not the people, so nobody is on the hook, and at the next meeting nobody has done it.
Only the last sentence, "Leo will put up signs", names who acts.

The fix puts the person or the thing first in each sentence: "Ana will have the radiators checked", "Grace will get a quote", "Leo thinks".
The guess about the parking spaces is now Leo's, not an anonymous "it is likely".

chaff counts the sentences of both forms together, five here, and labels each finding with its own form; so "It is ..." appears 5 times means five such sentences in all, two of them "It".

## Settings

The rule counts, across the whole document, sentences that open with "There is / are / was / were", and sentences that open with "It is / was" when a "that" clause follows ("it is raining" is not counted).
In the default level more than three such sentences are reported; `strict` allows one and `relaxed` six.

```yaml chaff-settings
rules:
  expletive-construction: relaxed
```

The rule does not run on technical documents, manuals and help pages, academic papers, statutes and contracts, literature, or verbatim transcripts.
In minutes that record who said what, a speaker's own words are not counted.

```text chaff-explain
$ npx chaffjs explain expletive-construction --genre business/meeting-notes

  Expletive construction   (expletive-construction)

  "There is" and "it is ... that" push the subject to the back and drop who does what.

  How to fix: Put the subject first. "There is a need to review" becomes "the board must review".

  Levels:
    strict   up to 1 such sentences
  → normal   up to 3 such sentences
    relaxed  up to 6 such sentences
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax expletive-construction --why "reason"
```

[All samples](README.md)
