<!-- chaff-sample
rule: vague-word-density
genre: business/report
file: handover-procedure.md
-->

# Too many vague words (`vague-word-density`)

**Where it helps:** procedures, policies, handover notes, service descriptions. Anywhere two readers must do the same thing.

## Original

```markdown chaff-before
# Front desk handover procedure

This note describes how the front desk hands over between the morning and the evening shift.
It applies to the main reception and to the side entrance on Mill Street.

Before the handover, the morning shift counts the visitor passes and checks the parcels waiting for collection.
Any problems are reported as needed to the duty manager, and the visitor log is updated in a timely manner.

The evening shift reads the log and asks about anything that is not clear.
Keys for the meeting rooms are returned to the key cabinet as appropriate.
Parcels that are not collected are kept for a reasonable time and then sent back to the sender.

If a visitor pass is missing, both shifts look for it together before the morning shift leaves.
The duty manager signs the log at the end of the handover.

The procedure was agreed by the facilities team in January and is reviewed every year.
Questions about it go to the facilities office on the ground floor, next to the post room.
A printed copy is kept in the top drawer of the front desk, with the emergency contact list.
New staff read it on their first day, and a member of the team walks them through one handover.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report handover-procedure.md

handover-procedure.md   business/report · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    Any problems are reported as needed to the duty manager, and the visitor log is updated in a timely manner.

  ·  Too many vague words

     "as needed" and other vague words: 19 per 1000 words (limit 4)
     "As appropriate", "as needed", "reasonable" and "in a timely manner" leave the reader to decide how far, how soon and what counts as done. One or two are ordinary; many leave much of the document to the reader, and two readers will fill it in differently. ISO/IEC/IEEE 29148 lists the same kind of word among those a requirement avoids. chaff speaks only when they are dense for the document's length. The words are listed in each language's lexicon.

     → Where it matters, say what, how far and by when: "report as needed" becomes "report every Friday", and "as appropriate" names the case.

     Relax this rule:  npx chaffjs relax vague-word-density


─── line 10 ──────────────────────────────────────────────────

    Keys for the meeting rooms are returned to the key cabinet as appropriate.

  ·  Too many vague words

     "as appropriate" and other vague words: 19 per 1000 words (limit 4)
     "As appropriate", "as needed", "reasonable" and "in a timely manner" leave the reader to decide how far, how soon and what counts as done. One or two are ordinary; many leave much of the document to the reader, and two readers will fill it in differently. ISO/IEC/IEEE 29148 lists the same kind of word among those a requirement avoids. chaff speaks only when they are dense for the document's length. The words are listed in each language's lexicon.

     → Where it matters, say what, how far and by when: "report as needed" becomes "report every Friday", and "as appropriate" names the case.

     Relax this rule:  npx chaffjs relax vague-word-density


─── line 11 ──────────────────────────────────────────────────

    Parcels that are not collected are kept for a reasonable time and then sent back to the sender.

  ·  Too many vague words

     "reasonable" and other vague words: 19 per 1000 words (limit 4)
     "As appropriate", "as needed", "reasonable" and "in a timely manner" leave the reader to decide how far, how soon and what counts as done. One or two are ordinary; many leave much of the document to the reader, and two readers will fill it in differently. ISO/IEC/IEEE 29148 lists the same kind of word among those a requirement avoids. chaff speaks only when they are dense for the document's length. The words are listed in each language's lexicon.

     → Where it matters, say what, how far and by when: "report as needed" becomes "report every Friday", and "as appropriate" names the case.

     Relax this rule:  npx chaffjs relax vague-word-density


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Front desk handover procedure

This note describes how the front desk hands over between the morning and the evening shift.
It applies to the main reception and to the side entrance on Mill Street.

Before the handover, the morning shift counts the visitor passes and checks the parcels waiting for collection.
A missing pass, a damaged parcel or a visitor still in the building is reported to the duty manager, and the visitor log is updated before the evening shift starts.

The evening shift reads the log and asks about anything that is not clear.
Keys for the meeting rooms are returned to the key cabinet when the last meeting of the day ends.
Parcels that are not collected are kept for ten working days and then sent back to the sender.

If a visitor pass is missing, both shifts look for it together before the morning shift leaves.
The duty manager signs the log at the end of the handover.

The procedure was agreed by the facilities team in January and is reviewed every year.
Questions about it go to the facilities office on the ground floor, next to the post room.
A printed copy is kept in the top drawer of the front desk, with the emergency contact list.
New staff read it on their first day, and a member of the team walks them through one handover.
```

## How it was fixed

"As needed", "in a timely manner", "as appropriate" and "a reasonable time" each leave a decision to whoever is on shift.
One of them would be ordinary. Four in a short procedure mean two people can follow it to the letter and still do different things, which is what a procedure is meant to prevent.

The fix says, for each one, what, when or how long: which problems are reported, before which moment the log is updated, when the keys go back, and how many days a parcel is kept.

## Settings

The rule counts vague words from chaff's list per 1000 words.
At `normal` it allows up to four per 1000 words; `strict` two and `relaxed` eight:

```yaml chaff-settings
rules:
  vague-word-density: relaxed
```

Very short documents are not measured, and each sentence is counted once.
In legal documents, terms that law defines ("reasonable", "best efforts") are not counted, and a word that a bracket right after it pins down ("a reasonable fee (USD 50)") is not counted either.

```text chaff-explain
$ npx chaffjs explain vague-word-density --genre business/report

  Too many vague words   (vague-word-density)

  "As appropriate", "as needed", "reasonable" and "in a timely manner" leave the reader to decide how far, how soon and what counts as done. One or two are ordinary; many leave much of the document to the reader, and two readers will fill it in differently. ISO/IEC/IEEE 29148 lists the same kind of word among those a requirement avoids. chaff speaks only when they are dense for the document's length. The words are listed in each language's lexicon.

  How to fix: Where it matters, say what, how far and by when: "report as needed" becomes "report every Friday", and "as appropriate" names the case.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 2 vague words per 1000 words
  → normal   up to 4 vague words per 1000 words
    relaxed  up to 8 vague words per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax vague-word-density --why "reason"
```

[All samples](README.md)
